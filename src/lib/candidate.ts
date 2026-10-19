"use client";

export type Candidate = {
  id: number;
  registrationId: string;
  fullName: string;
  email: string;
  photoUrl: string | null;
  coursePreference: string | null;
  testCode: string | null;
};

const KEY = "sfi_candidate";

export function loadCandidate(): Candidate | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Candidate) : null;
  } catch {
    return null;
  }
}

export function saveCandidate(candidate: Candidate) {
  localStorage.setItem(KEY, JSON.stringify(candidate));
}

export function clearCandidate() {
  localStorage.removeItem(KEY);
}
