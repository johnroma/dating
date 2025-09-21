// Dev users for /dev/login page (development only)
// Always returns hardcoded users for fast, reliable dev login

export type DevUser = {
  id: string;
  displayName: string;
  role: 'member' | 'admin';
};

// Hardcoded dev users - always used for /dev/login
const DEV_USERS: DevUser[] = [
  { id: 'admin', displayName: 'Admin (Dev)', role: 'admin' },
  { id: 'member', displayName: 'Member (Dev)', role: 'member' },
];

export async function getDevUsers(): Promise<DevUser[]> {
  // Always return hardcoded users for dev login page
  // This is faster and more reliable than database queries
  return DEV_USERS;
}
