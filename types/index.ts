export type UserRole = 'admin' | 'store_manager' | 'store_officer' | 'viewer'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  department_id: string | null
  phone: string | null
  employee_id: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  department?: Department
}

export interface Category {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
  parent?: Category
  children?: Category[]
  item_count?: number
}

export interface Unit {
  id: string
  name: string
  abbreviation: string
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  contact_person: string | null
  email: string | null
  phone: string | null
  address: string | null
  tin_number: string | null
  bank_name: string | null
  bank_account: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  name: string
  code: string
  head_of_department: string | null
  phone: string | null
  email: string | null
  location: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InventoryItem {
  id: string
  item_code: string
  name: string
  description: string | null
  category_id: string | null
  unit_id: string
  quantity_in_stock: number
  reorder_level: number
  reorder_quantity: number
  unit_cost: number
  total_value: number
  location: string | null
  bin_number: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  category?: Category
  unit?: Unit
}

export type GRNStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export interface GoodsReceivedNote {
  id: string
  grn_number: string
  supplier_id: string
  received_by: string
  approved_by: string | null
  delivery_note_number: string | null
  invoice_number: string | null
  purchase_order_number: string | null
  received_date: string
  total_value: number
  status: GRNStatus
  notes: string | null
  created_at: string
  updated_at: string
  supplier?: Supplier
  received_by_profile?: Profile
  approved_by_profile?: Profile
  items?: GRNItem[]
}

export interface GRNItem {
  id: string
  grn_id: string
  item_id: string
  quantity_ordered: number | null
  quantity_received: number
  unit_cost: number
  total_cost: number
  expiry_date: string | null
  batch_number: string | null
  notes: string | null
  item?: InventoryItem
}

export type IssueVoucherStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'issued'

export interface IssueVoucher {
  id: string
  voucher_number: string
  department_id: string
  requested_by: string
  approved_by: string | null
  issued_by: string | null
  request_date: string
  approved_date: string | null
  issued_date: string | null
  purpose: string | null
  total_value: number
  status: IssueVoucherStatus
  notes: string | null
  created_at: string
  updated_at: string
  department?: Department
  requested_by_profile?: Profile
  approved_by_profile?: Profile
  issued_by_profile?: Profile
  items?: IssueVoucherItem[]
}

export interface IssueVoucherItem {
  id: string
  voucher_id: string
  item_id: string
  quantity_requested: number
  quantity_approved: number | null
  quantity_issued: number | null
  unit_cost: number
  total_cost: number
  notes: string | null
  item?: InventoryItem
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  table_name: string
  record_id: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  user?: Profile
}

export interface StockAlert {
  id: string
  item_id: string
  alert_type: 'low_stock' | 'out_of_stock' | 'overstock' | 'expiry_soon'
  is_resolved: boolean
  resolved_at: string | null
  created_at: string
  item?: InventoryItem
}

// Dashboard summary types
export interface DashboardStats {
  total_items: number
  total_value: number
  low_stock_items: number
  out_of_stock_items: number
  pending_grns: number
  pending_requisitions: number
  total_suppliers: number
  total_departments: number
  monthly_receipts: number
  monthly_issues: number
}

export interface StockMovement {
  date: string
  receipts: number
  issues: number
}

export interface CategoryDistribution {
  name: string
  value: number
  count: number
}

// Table/pagination helpers
export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface FilterParams {
  search?: string
  category_id?: string
  department_id?: string
  supplier_id?: string
  status?: string
  from_date?: string
  to_date?: string
  is_active?: boolean
}
