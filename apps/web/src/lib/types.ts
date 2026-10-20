export const USER_ROLES = ['PLATFORM_ADMIN', 'OWNER', 'SALES', 'STOCK_KEEPER', 'DELIVERY'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const DEPOT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;

export type DepotStatus = (typeof DEPOT_STATUSES)[number];

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  depotId: string | null;
}

export interface SessionDepot {
  id: string;
  name: string;
  status: DepotStatus;
}

export interface AuthSession {
  user: SessionUser;
  depot: SessionDepot | null;
  accessToken: string;
}

export type LogoutReason =
  | 'session-expired'
  | 'service-unavailable'
  | 'depot-pending'
  | 'depot-rejected'
  | 'depot-suspended'
  | 'logout';

export interface DepotAdminView {
  id: string;
  name: string;
  slug: string;
  phone: string;
  email: string;
  status: DepotStatus;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface RegisteredDepot {
  depot: {
    id: string;
    name: string;
    status: DepotStatus;
  };
  owner: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
}
