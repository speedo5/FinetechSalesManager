import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import * as stockAllocationService from '@/services/stockAllocationService';

export default function AllocationAudit() {
  const { currentUser, stockAllocations, setStockAllocations, users, imeis } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch allocations from API on mount
  useEffect(() => {
    const fetchAllocations = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('📋 Fetching stock allocations from API...');
        
        const response = await stockAllocationService.getAllocations();
        
        if (response.success && response.data) {
          const allocations = Array.isArray(response.data) ? response.data : (typeof response.data === 'object' && response.data !== null && 'data' in response.data ? (response.data as any).data : []) || [];
          console.log('✓ Allocations loaded:', allocations.length);
          setStockAllocations(allocations);
        } else {
          const errorMsg = 'Failed to load allocations';
          setError(errorMsg);
          console.warn('⚠️', errorMsg, response);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load allocations';
        setError(errorMsg);
        console.error('❌ Error fetching allocations:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllocations();
  }, [setStockAllocations]);

  // Filter allocations
  const filteredAllocations = useMemo(() => {
    return stockAllocations
      .filter(alloc => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const fromName = typeof alloc.fromUserId === 'object' && alloc.fromUserId
            ? alloc.fromUserId.name
            : alloc.fromUserName;
          const toName = typeof alloc.toUserId === 'object' && alloc.toUserId
            ? alloc.toUserId.name
            : alloc.toUserName;
          const matchesProduct = typeof alloc.productId === 'object' && alloc.productId
            ? alloc.productId.name?.toLowerCase().includes(query)
            : alloc.productName?.toLowerCase().includes(query);
          const matchesImei = alloc.imei?.includes(query);
          const matchesUser = fromName?.toLowerCase().includes(query) || 
                              toName?.toLowerCase().includes(query);
          if (!matchesProduct && !matchesImei && !matchesUser) return false;
        }
        
        // Level filter - check both toLevel and level fields
        const toLevel = alloc.toLevel || alloc.level;
        if (levelFilter !== 'all' && toLevel !== levelFilter) return false;
        
        // Status filter
        if (statusFilter !== 'all' && alloc.status !== statusFilter) return false;
        
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [stockAllocations, searchQuery, levelFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: stockAllocations.length,
      completed: stockAllocations.filter(a => a.status === 'completed').length,
      pending: stockAllocations.filter(a => a.status === 'pending').length,
      reversed: stockAllocations.filter(a => a.status === 'reversed').length,
      toRegional: stockAllocations.filter(a => {
        const level = (a.toLevel || a.level) as string;
        return level === 'regional_manager';
      }).length,
      toTeam: stockAllocations.filter(a => {
        const level = (a.toLevel || a.level) as string;
        return level === 'team_leader';
      }).length,
      toFO: stockAllocations.filter(a => {
        const level = (a.toLevel || a.level) as string;
        return level === 'field_officer';
      }).length,
    };
  }, [stockAllocations]);

  const getRoleBadge = (role: string | undefined) => {
    if (!role) {
      return (
        <Badge className="bg-gray-100 text-gray-800">
          Unknown
        </Badge>
      );
    }
    
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      regional_manager: 'bg-blue-100 text-blue-800',
      team_leader: 'bg-green-100 text-green-800',
      field_officer: 'bg-orange-100 text-orange-800',
    };
    return (
      <Badge className={colors[role] || 'bg-gray-100 text-gray-800'}>
        {role.replace('_', ' ')}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'reversed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <MainLayout>
        <div className="p-8">Access denied. This page is for admins only.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Allocation Audit Trail</h1>
          <p className="text-muted-foreground">
            Complete history of all stock allocations in the system
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7 mb-6">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Reversed</p>
              <p className="text-2xl font-bold text-red-600">{stats.reversed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">To Regional</p>
              <p className="text-2xl font-bold">{stats.toRegional}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">To Team</p>
              <p className="text-2xl font-bold">{stats.toTeam}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">To FO</p>
              <p className="text-2xl font-bold">{stats.toFO}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by product, IMEI, or user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="regional">To Regional</SelectItem>
                  <SelectItem value="team">To Team</SelectItem>
                  <SelectItem value="fo">To FO</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Allocations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Allocation Records</CardTitle>
            <CardDescription>{filteredAllocations.length} records found</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                <p className="font-semibold">Error loading allocations</p>
                <p className="text-sm">{error}</p>
              </div>
            )}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                <p className="text-muted-foreground">Loading allocation records...</p>
              </div>
            ) : (
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>IMEI</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAllocations.map(allocation => {
                  // Extract user info from populated objects or flat fields
                  const fromUserName = typeof allocation.fromUserId === 'object' && allocation.fromUserId
                    ? allocation.fromUserId.name
                    : allocation.fromUserName;
                  const fromUserRole = typeof allocation.fromUserId === 'object' && allocation.fromUserId
                    ? allocation.fromUserId.role
                    : allocation.fromRole;
                  const toUserName = typeof allocation.toUserId === 'object' && allocation.toUserId
                    ? allocation.toUserId.name
                    : allocation.toUserName;
                  const toUserRole = typeof allocation.toUserId === 'object' && allocation.toUserId
                    ? allocation.toUserId.role
                    : allocation.toRole;
                  const productName = typeof allocation.productId === 'object' && allocation.productId
                    ? allocation.productId.name
                    : allocation.productName;
                  const toLevel = allocation.toLevel || allocation.level;
                  const key = allocation._id || allocation.id || `${allocation.imei}-${allocation.createdAt}`;
                  
                  return (
                    <TableRow key={key}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(allocation.createdAt), 'PPP p')}
                      </TableCell>
                      <TableCell className="font-medium">{productName || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{allocation.imei || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3 text-red-500" />
                            {fromUserName || 'Unknown'}
                          </span>
                          {fromUserRole ? getRoleBadge(fromUserRole) : <span className="text-xs text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1">
                            <ArrowDownRight className="h-3 w-3 text-green-500" />
                            {toUserName || 'Unknown'}
                          </span>
                          {toUserRole ? getRoleBadge(toUserRole) : <span className="text-xs text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {toLevel ? toLevel.replace('_', ' ') : '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(allocation.status)}
                          <span className="capitalize">{allocation.status}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredAllocations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No allocation records found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
