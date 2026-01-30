import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Users, 
  Globe, 
  Briefcase, 
  UserCheck, 
  TrendingUp, 
  DollarSign,
  Phone,
  Building2,
  RotateCcw
} from 'lucide-react';
import { PhoneSource } from '@/types';
import { salesService } from '@/services/salesService';
import { userService } from '@/services/userService';
import { commissionService } from '@/services/commissionService';
import { toast } from 'sonner';

export default function RegionalDashboard() {
  const { currentUser } = useApp();
  const [activeTab, setActiveTab] = useState('overview');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  
  // Data from API
  const [loadedUsers, setLoadedUsers] = useState<any[]>([]);
  const [loadedSales, setLoadedSales] = useState<any[]>([]);
  const [loadedCommissions, setLoadedCommissions] = useState<any[]>([]);

  // Get current regional manager's region
  const myRegion = currentUser?.region;

  // Load data from database on mount
  useEffect(() => {
    if (!currentUser) return;

    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load users from database
        const usersResponse = await userService.getAll();
        if (usersResponse.success && usersResponse.data) {
          const users = Array.isArray(usersResponse.data) ? usersResponse.data : (usersResponse.data as any)?.data || [];
          setLoadedUsers(users);
        }

        // Load sales from database
        const salesResponse = await salesService.getAll();
        if (salesResponse.success && salesResponse.data) {
          const sales = Array.isArray(salesResponse.data) ? salesResponse.data : (salesResponse.data as any)?.data || [];
          setLoadedSales(sales);
        }

        // Load commissions from database
        const commissionsResponse = await commissionService.getAll();
        if (commissionsResponse.success && commissionsResponse.data) {
          const commissions = Array.isArray(commissionsResponse.data) ? commissionsResponse.data : (commissionsResponse.data as any)?.data || [];
          setLoadedCommissions(commissions);
        }
      } catch (error) {
        console.error('Failed to load regional dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  // Get team leaders in this region
  const teamLeaders = useMemo(() => 
    loadedUsers.filter(u => 
      u.role === 'team_leader' && 
      (u.region === myRegion || u.regionalManagerId === currentUser?.id)
    ), [loadedUsers, myRegion, currentUser?.id]
  );

  // Get FOs under those team leaders
  const fieldOfficers = useMemo(() => 
    loadedUsers.filter(u => 
      u.role === 'field_officer' && 
      (u.region === myRegion || teamLeaders.some(tl => tl.id === u.teamLeaderId))
    ), [loadedUsers, myRegion, teamLeaders]
  );

  // All team member IDs (team leaders + FOs)
  const teamMemberIds = useMemo(() =>
    [...teamLeaders.map(t => t.id), ...fieldOfficers.map(f => f.id)],
    [teamLeaders, fieldOfficers]
  );

  // Get sales from this region's team
  const regionSales = useMemo(() => 
    loadedSales.filter(sale => {
      const matchesTeam = teamMemberIds.includes(sale.createdBy) || 
                          fieldOfficers.some(fo => fo.foCode === sale.foCode);
      const matchesSource = sourceFilter === 'all' || sale.source === sourceFilter;
      return matchesTeam && matchesSource;
    }), [loadedSales, teamMemberIds, fieldOfficers, sourceFilter]
  );

  // Get commissions for this region's FOs
  const regionCommissions = useMemo(() =>
    loadedCommissions.filter(comm =>
      fieldOfficers.some(fo => fo.id === comm.foId)
    ), [loadedCommissions, fieldOfficers]
  );

  // Stats
  const totalRevenue = useMemo(() =>
    regionSales.reduce((sum, s) => sum + s.saleAmount, 0),
    [regionSales]
  );
  
  const totalCommissions = useMemo(() =>
    regionCommissions.reduce((sum, c) => sum + c.amount, 0),
    [regionCommissions]
  );
  
  const pendingCommissions = useMemo(() =>
    regionCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0),
    [regionCommissions]
  );

  // Sales by source
  const salesBySource = useMemo(() => ({
    watu: regionSales.filter(s => s.source === 'watu').reduce((sum, s) => sum + s.saleAmount, 0),
    mogo: regionSales.filter(s => s.source === 'mogo').reduce((sum, s) => sum + s.saleAmount, 0),
    onfon: regionSales.filter(s => s.source === 'onfon').reduce((sum, s) => sum + s.saleAmount, 0),
  }), [regionSales]);

  const getSourceBadgeClass = (source: PhoneSource | string) => {
    switch (source) {
      case 'watu': return 'bg-watu text-white';
      case 'mogo': return 'bg-mogo text-white';
      case 'onfon': return 'bg-onfon text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Check access
  if (currentUser?.role !== 'regional_manager' && currentUser?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Access denied. Regional Manager only.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground flex items-center gap-2">
              <Globe className="h-6 w-6 text-primary" />
              Regional Dashboard
            </h1>
            <div className="text-sm text-muted-foreground mt-1 space-y-1">
              {myRegion && (
                <p>
                  <span className="font-medium text-foreground">{myRegion}</span> Region
                </p>
              )}
              {currentUser?.name && (
                <p>
                  Regional Manager: <span className="font-medium text-foreground">{currentUser.name}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => {
                setIsLoading(true);
                Promise.all([
                  userService.getAll(),
                  salesService.getAll(),
                  commissionService.getAll()
                ]).then(([usersRes, salesRes, commissionsRes]) => {
                  if (usersRes.success && usersRes.data) setLoadedUsers(Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data as any)?.data || []);
                  if (salesRes.success && salesRes.data) setLoadedSales(Array.isArray(salesRes.data) ? salesRes.data : (salesRes.data as any)?.data || []);
                  if (commissionsRes.success && commissionsRes.data) setLoadedCommissions(Array.isArray(commissionsRes.data) ? commissionsRes.data : (commissionsRes.data as any)?.data || []);
                  toast.success('Dashboard refreshed');
                }).catch(() => {
                  toast.error('Failed to refresh dashboard');
                }).finally(() => {
                  setIsLoading(false);
                });
              }}
              disabled={isLoading}
              className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
              title="Refresh dashboard data"
            >
              <RotateCcw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="watu">Watu</SelectItem>
                <SelectItem value="mogo">Mogo</SelectItem>
                <SelectItem value="onfon">Onfon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">Ksh {totalRevenue.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Region Revenue</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{regionSales.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Sales</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <Briefcase className="h-6 w-6 sm:h-8 sm:w-8 text-warning shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{teamLeaders.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Team Leaders</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <UserCheck className="h-6 w-6 sm:h-8 sm:w-8 text-success shrink-0" />
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold">{fieldOfficers.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">Field Officers</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Company-wise Sales */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {(['watu', 'mogo', 'onfon'] as PhoneSource[]).map(source => (
            <Card key={source} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${getSourceBadgeClass(source)}`}>
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium capitalize">{source}</p>
                      <p className="text-xs text-muted-foreground">
                        {regionSales.filter(s => s.source === source).length} sales
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-bold">
                    Ksh {salesBySource[source].toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team-leaders">Team Leaders</TabsTrigger>
            <TabsTrigger value="field-officers">Field Officers</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Recent Sales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {regionSales.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No sales yet</p>
                  ) : (
                    <div className="space-y-3">
                      {regionSales.slice(0, 5).map(sale => (
                        <div key={sale.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{sale.productName}</p>
                            <p className="text-xs text-muted-foreground">{sale.sellerName}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm text-success">Ksh {sale.saleAmount.toLocaleString()}</p>
                            {sale.source && (
                              <Badge className={`text-xs ${getSourceBadgeClass(sale.source)}`}>
                                {sale.source.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-warning" />
                    Commission Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg">
                      <span className="text-sm">Total Paid</span>
                      <span className="font-bold text-success">
                        Ksh {(totalCommissions - pendingCommissions).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg">
                      <span className="text-sm">Pending</span>
                      <span className="font-bold text-warning">
                        Ksh {pendingCommissions.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium">Total</span>
                      <span className="font-bold">
                        Ksh {totalCommissions.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Team Leaders Tab */}
          <TabsContent value="team-leaders">
            <Card className="border shadow-sm">
              <CardHeader className="border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-warning" />
                  Team Leaders in {myRegion || 'Your Region'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {teamLeaders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No team leaders in this region
                  </div>
                ) : (
                  <div className="divide-y">
                    {teamLeaders.map(tl => {
                      const tlFOs = fieldOfficers.filter(fo => fo.teamLeaderId === tl.id);
                      const tlSales = regionSales.filter(s => 
                        tlFOs.some(fo => fo.foCode === s.foCode || fo.id === s.createdBy)
                      );
                      const tlRevenue = tlSales.reduce((sum, s) => sum + s.saleAmount, 0);

                      return (
                        <div key={tl.id} className="p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-warning flex items-center justify-center">
                                <Briefcase className="h-5 w-5 text-warning-foreground" />
                              </div>
                              <div>
                                <p className="font-medium">{tl.name}</p>
                                <p className="text-sm text-muted-foreground">{tl.email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-success">Ksh {tlRevenue.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">{tlFOs.length} FOs | {tlSales.length} sales</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Field Officers Tab */}
          <TabsContent value="field-officers">
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-success" />
                  Field Officers in {myRegion || 'Your Region'}
                </CardTitle>
              </CardHeader>
              {/* Mobile Cards */}
              <div className="block lg:hidden p-4 space-y-3">
                {fieldOfficers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No field officers in this region
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fieldOfficers.map(fo => {
                      const foSales = regionSales.filter(s => s.foCode === fo.foCode || s.createdBy === fo.id);
                      const foRevenue = foSales.reduce((sum, s) => sum + s.saleAmount, 0);
                      const teamLeader = loadedUsers.find(u => u.id === fo.teamLeaderId);

                      return (
                        <Card key={fo.id} className="border border-success/20 bg-success/5">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-success flex items-center justify-center shrink-0">
                              <UserCheck className="h-5 w-5 text-success-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{fo.name}</p>
                                <Badge className="bg-success/20 text-success border-0 text-xs">
                                  {fo.foCode}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground truncate">{fo.email}</p>
                              {fo.phone && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                  <Phone className="h-3 w-3" /> {fo.phone}
                                </p>
                              )}
                              {teamLeader && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  TL: {teamLeader.name}
                                </p>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-muted-foreground">{foSales.length} sales</span>
                                <span className="font-bold text-success">Ksh {foRevenue.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>FO Code</th>
                      <th>Name</th>
                      <th>Team Leader</th>
                      <th>Phone</th>
                      <th>Sales</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldOfficers.map(fo => {
                      const foSales = regionSales.filter(s => s.foCode === fo.foCode || s.createdBy === fo.id);
                      const foRevenue = foSales.reduce((sum, s) => sum + s.saleAmount, 0);
                      const teamLeader = loadedUsers.find(u => u.id === fo.teamLeaderId);

                      return (
                        <tr key={fo.id}>
                          <td>
                            <Badge className="bg-success/20 text-success border-0">
                              {fo.foCode}
                            </Badge>
                          </td>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-success flex items-center justify-center">
                                <UserCheck className="h-4 w-4 text-success-foreground" />
                              </div>
                              <div>
                                <p className="font-medium">{fo.name}</p>
                                <p className="text-xs text-muted-foreground">{fo.email}</p>
                              </div>
                            </div>
                          </td>
                          <td>{teamLeader?.name || '-'}</td>
                          <td className="text-muted-foreground">{fo.phone || '-'}</td>
                          <td>{foSales.length}</td>
                          <td className="font-bold text-success">Ksh {foRevenue.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}