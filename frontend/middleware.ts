import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyTokenEdge } from '@/lib/authEdge';

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 1. Extract token from HTTP-only / browser cookie or Authorization header
  let token: string | undefined = request.cookies.get('auth_token')?.value;
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  const payload = await verifyTokenEdge(token);
  const isAuthenticated = !!payload;
  const userRole = payload?.role || 'PATIENT'; // Default legacy fallback if token lacks role

  // ==========================================
  // Doctor Protected Pages: /doctor/:path*
  // ==========================================
  if (pathname.startsWith('/doctor')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/auth/doctor/login', request.url);
      loginUrl.searchParams.set('redirect', pathname + search);
      return NextResponse.redirect(loginUrl);
    }

    if (userRole !== 'DOCTOR') {
      // Patients cannot access doctor portal pages
      const redirectUrl = new URL('/patient/overview', request.url);
      redirectUrl.searchParams.set('error', 'unauthorized_doctor_access');
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
  }

  // ==========================================
  // Patient Protected Pages: /patient/:path*, /upload, /onboarding
  // ==========================================
  if (
    pathname.startsWith('/patient') ||
    pathname.startsWith('/upload') ||
    pathname.startsWith('/onboarding')
  ) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/auth/patient/login', request.url);
      loginUrl.searchParams.set('redirect', pathname + search);
      return NextResponse.redirect(loginUrl);
    }

    if (userRole !== 'PATIENT') {
      // Doctors cannot access patient portal pages as if they were patients
      const redirectUrl = new URL('/doctor/dashboard', request.url);
      redirectUrl.searchParams.set('error', 'unauthorized_patient_access');
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
  }

  // ==========================================
  // Doctor Protected API Endpoints: /api/doctor/:path*
  // ==========================================
  if (pathname.startsWith('/api/doctor')) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    if (userRole !== 'DOCTOR') {
      return NextResponse.json(
        { error: 'Forbidden: Access restricted to authorized doctors.' },
        { status: 403 }
      );
    }

    return NextResponse.next();
  }

  // ==========================================
  // Patient Protected API Endpoints:
  // /api/patient/:path*, /api/user/dashboard, /api/user/save-ocr, /api/user/onboarding
  // ==========================================
  if (
    pathname.startsWith('/api/patient') ||
    pathname.startsWith('/api/user/dashboard') ||
    pathname.startsWith('/api/user/save-ocr') ||
    pathname.startsWith('/api/user/onboarding')
  ) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    if (userRole !== 'PATIENT') {
      return NextResponse.json(
        { error: 'Forbidden: Doctor accounts cannot access patient portal endpoints as a patient.' },
        { status: 403 }
      );
    }

    return NextResponse.next();
  }

  // ==========================================
  // Auth Portals (/auth, /auth/patient/..., /auth/doctor/...)
  // If user is already authenticated with a valid session, redirect to their dashboard
  // ==========================================
  if (pathname === '/auth') {
    if (isAuthenticated) {
      return NextResponse.redirect(
        new URL(userRole === 'DOCTOR' ? '/doctor/dashboard' : '/patient/overview', request.url)
      );
    }
  }

  if (pathname === '/auth/patient/login' || pathname === '/auth/patient/signup') {
    if (isAuthenticated) {
      if (userRole === 'PATIENT') {
        return NextResponse.redirect(new URL('/patient/overview', request.url));
      } else if (userRole === 'DOCTOR') {
        return NextResponse.redirect(new URL('/doctor/dashboard', request.url));
      }
    }
  }

  if (pathname === '/auth/doctor/login' || pathname === '/auth/doctor/signup') {
    if (isAuthenticated) {
      if (userRole === 'DOCTOR') {
        return NextResponse.redirect(new URL('/doctor/dashboard', request.url));
      } else if (userRole === 'PATIENT') {
        return NextResponse.redirect(new URL('/patient/overview', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/doctor/:path*',
    '/patient/:path*',
    '/upload/:path*',
    '/onboarding/:path*',
    '/auth',
    '/auth/:path*',
    '/api/doctor/:path*',
    '/api/patient/:path*',
    '/api/user/dashboard/:path*',
    '/api/user/save-ocr/:path*',
    '/api/user/onboarding/:path*',
  ],
};
