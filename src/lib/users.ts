// Minimal user types for Step 1 (used later in Step 2 auth wiring)
export type UserRole = 'user' | 'moderator';
export type User = {
  id: string;
  email: string | null;
  displayName: string;
  role: UserRole;
  createdAt: string;
  deletedAt: string | null;
};

export const DEV_SQLITE_USERS: ReadonlyArray<
  Pick<User, 'id' | 'displayName' | 'role'>
> = [
  { id: 'sqlite-user', displayName: 'SQLite User', role: 'user' },
  {
    id: 'sqlite-moderator',
    displayName: 'SQLite Moderator',
    role: 'moderator',
  },
];
