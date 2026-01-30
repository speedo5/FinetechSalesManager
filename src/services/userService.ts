/**
 * =============================================================================
 * USER SERVICE
 * =============================================================================
 * 
 * Handles user management operations.
 * 
 * API ENDPOINTS:
 * - GET    /users              - List all users (with filters)
 * - GET    /users/:id          - Get user by ID
 * - POST   /users              - Create new user
 * - PUT    /users/:id          - Update user
 * - DELETE /users/:id          - Delete user
 * - PUT    /users/:id/assign-team-leader - Assign FO to team leader
 * - GET    /users/field-officers - Get all field officers
 * - GET    /users/team-leaders   - Get all team leaders
 * 
 * SAMPLE REQUEST/RESPONSE:
 * ------------------------
 * GET /users?role=field_officer&region=Nairobi
 * Response: { success: true, data: [...users], total: 25 }
 * 
 * POST /users
 * Request:  { name: "John", email: "john@example.com", role: "field_officer", ... }
 * Response: { success: true, data: { id, name, email, role, foCode, ... } }
 * 
 * =============================================================================
 */

import { apiClient, type ApiResponse } from './apiClient';
import type { User, UserRole } from '@/types';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface UserListParams {
  role?: UserRole;
  region?: string;
  teamLeaderId?: string;
  regionalManagerId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  region?: string;
  phone?: string;
  teamLeaderId?: string;
  regionalManagerId?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: UserRole;
  region?: string;
  phone?: string;
  isActive?: boolean;
}

export interface UserListResponse {
  users: User[];
  total: number;
}

// -----------------------------------------------------------------------------
// SERVICE
// -----------------------------------------------------------------------------

export const userService = {
  /**
   * Get all users with optional filters
   */
  getAll: async (params?: UserListParams): Promise<ApiResponse<UserListResponse>> => {
    const queryParams: Record<string, string> = {};
    
    if (params?.role) queryParams.role = params.role;
    if (params?.region) queryParams.region = params.region;
    if (params?.teamLeaderId) queryParams.teamLeaderId = params.teamLeaderId;
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    
    return apiClient.get<UserListResponse>('/users', queryParams);
  },

  /**
   * Get a single user by ID
   */
  getById: async (id: string): Promise<ApiResponse<User>> => {
    return apiClient.get<User>(`/users/${id}`);
  },

  /**
   * Create a new user
   */
  create: async (userData: CreateUserRequest): Promise<ApiResponse<User>> => {
    return apiClient.post<User>('/users', userData);
  },

  /**
   * Update an existing user
   */
  update: async (id: string, userData: UpdateUserRequest): Promise<ApiResponse<User>> => {
    return apiClient.put<User>(`/users/${id}`, userData);
  },

  /**
   * Delete a user
   */
  delete: async (id: string): Promise<ApiResponse<void>> => {
    return apiClient.delete<void>(`/users/${id}`);
  },

  /**
   * Assign a field officer to a team leader
   */
  assignTeamLeader: async (foId: string, teamLeaderId: string): Promise<ApiResponse<User>> => {
    return apiClient.put<User>(`/users/${foId}/assign-team-leader`, { teamLeaderId });
  },

  /**
   * Get all field officers
   */
  getFieldOfficers: async (): Promise<ApiResponse<User[]>> => {
    return apiClient.get<User[]>('/users/field-officers');
  },

  /**
   * Get all team leaders
   */
  getTeamLeaders: async (): Promise<ApiResponse<User[]>> => {
    return apiClient.get<User[]>('/users/team-leaders');
  },

  /**
   * Get subordinates for a user (based on role hierarchy)
   */
  getSubordinates: async (userId: string): Promise<ApiResponse<User[]>> => {
    return apiClient.get<User[]>(`/users/${userId}/subordinates`);
  },
};

export default userService;
