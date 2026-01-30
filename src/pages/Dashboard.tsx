import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { RevenueChart, SalesPieChart } from '@/components/dashboard/Charts';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardService, type DashboardStats, type MappedDashboardStats, type TopSeller, type ChartDataPoint } from '@/services/dashboardService';
import { salesService } from '@/services/salesService';
import { toast } from 'sonner';
import { 
  DollarSign, 
  ShoppingCart, 
  Smartphone, 
  TrendingUp,
  Package,
  Users,
  AlertCircle,
  BarChart3
} from 'lucide-react';

export default function Dashboard() {
  const { currentUser, sales, users } = useApp();
  
  // State for API data
  const [stats, setStats] = useState<MappedDashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch dashboard data on mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const [statsRes, chartRes, sellersRes, salesRes] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getSalesChart('week'),
          dashboardService.getTopSellers(5),
          salesService.getAll({ limit: 5 }),
        ]);

        // Map the API response to the expected format
        if (statsRes.data) {
          const apiData = statsRes.data as DashboardStats;
          const mappedStats: MappedDashboardStats = {
            totalRevenue: apiData.sales?.month?.revenue || 0,
            todayRevenue: apiData.sales?.today?.revenue || 0,
            totalSales: apiData.sales?.month?.count || 0,
            todaySales: apiData.sales?.today?.count || 0,
            totalPhones: apiData.stock?.total || 0,
            phonesInStock: apiData.stock?.total || 0,
            phonesSold: 0,
            allocatedPhones: apiData.stock?.allocated || 0,
            pendingCommissions: apiData.commissions?.pending || 0,
            totalCommissionsPaid: 0,
          };
          setStats(mappedStats);
        }
        if (chartRes.data) setChartData(chartRes.data);
        
        // Calculate top sellers from sales context for accurate data
        // Build seller map from sales data
        const sellerMap = new Map<string, { name: string; count: number; revenue: number }>();
        
        sales.forEach((sale) => {
          const foId = sale.foId || sale.createdBy;
          if (!foId) return; // Skip if no FO ID
          
          // Try to find the user in the users array
          const seller = users.find(u => u.id === foId);
          const sellerName = seller?.name || 'Unknown';
          
          if (!sellerMap.has(foId)) {
            sellerMap.set(foId, { name: sellerName, count: 0, revenue: 0 });
          }
          
          const data = sellerMap.get(foId)!;
          data.count += 1;
          data.revenue += sale.saleAmount || 0;
        });
        
        const calculated = Array.from(sellerMap.entries())
          .map(([userId, data]) => {
            const userObj = users.find(u => u.id === userId);
            return {
              userId,
              userName: data.name,
              foCode: userObj?.foCode || '',
              region: userObj?.region || '',
              salesCount: data.count,
              totalRevenue: data.revenue,
              commission: 0,
            };
          })
          .sort((a, b) => b.totalRevenue - a.totalRevenue)
          .slice(0, 5);
        
        setTopSellers(calculated);
        
        // Handle both data and sales fields for recent sales
        const salesData = salesRes.data;
        if (salesData && (salesData.data?.length > 0 || salesData.sales?.length > 0)) {
          const sales = (salesData.data || salesData.sales || []) as any[];
          setRecentSales(sales);
        } else {
          // Fallback: Use sales from context
          const recentFromContext = sales
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);
          setRecentSales(recentFromContext);
        }
      } catch (error) {
        toast.error('Failed to load dashboard data');
        console.error(error);
        
        // Use context data as fallback on error
        const sellerMap = new Map<string, { name: string; count: number; revenue: number }>();
        sales.forEach((sale) => {
          const foId = sale.foId || sale.createdBy;
          const seller = users.find(u => u.id === foId);
          const sellerName = seller?.name || 'Unknown';
          
          if (!sellerMap.has(foId)) {
            sellerMap.set(foId, { name: sellerName, count: 0, revenue: 0 });
          }
          const data = sellerMap.get(foId)!;
          data.count += 1;
          data.revenue += sale.saleAmount || 0;
        });
        
        const calculated = Array.from(sellerMap.entries())
          .map(([userId, data]) => ({
            userId,
            userName: data.name,
            foCode: '',
            region: users.find(u => u.id === userId)?.region || '',
            salesCount: data.count,
            totalRevenue: data.revenue,
            commission: 0,
          }))
          .sort((a, b) => b.totalRevenue - a.totalRevenue)
          .slice(0, 5);
        
        setTopSellers(calculated);
        
        const recentFromContext = sales
          .slice()
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
        setRecentSales(recentFromContext);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [sales, users]);

  // Transform chart data to match component format
  const transformedChartData = useMemo(() => {
    return chartData.map((point: any) => {
      // Handle both point.date and point._id field names
      const dateStr = point.date || point._id;
      // Parse date string in format YYYY-MM-DD
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      return {
        name: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        value: point.revenue || point.sales || 0,
      };
    });
  }, [chartData]);

  // Calculate stats from context if API stats are not available
  const calculatedStats = useMemo(() => {
    if (stats) return stats;
    
    const totalRevenue = sales.reduce((sum, s) => sum + (s.saleAmount || 0), 0);
    const totalSalesCount = sales.length;
    
    // Get today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = sales.filter(s => {
      const saleDate = new Date(s.createdAt);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate.getTime() === today.getTime();
    });
    const todayRevenue = todaySales.reduce((sum, s) => sum + (s.saleAmount || 0), 0);
    
    return {
      totalRevenue,
      todayRevenue,
      totalSales: totalSalesCount,
      todaySales: todaySales.length,
      totalPhones: 0,
      phonesInStock: 0,
      phonesSold: 0,
      allocatedPhones: 0,
      pendingCommissions: 0,
      totalCommissionsPaid: 0,
    };
  }, [stats, sales]);

  // Calculate sales by category from recent sales
  const salesByCategoryData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    recentSales.forEach((sale) => {
      const category = sale.productName || 'Other';
      categoryMap.set(category, (categoryMap.get(category) || 0) + sale.saleAmount);
    });
    
    return Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [recentSales]);

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {currentUser?.name}. Here's your business overview.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Revenue"
            value={isLoading ? '...' : `Ksh ${(calculatedStats?.totalRevenue || 0).toLocaleString()}`}
            subtitle="This month"
            icon={DollarSign}
            variant="primary"
            trend={{ value: 12.5, isPositive: true }}
          />
          <StatCard
            title="Today's Sales"
            value={isLoading ? '...' : calculatedStats?.todaySales || 0}
            subtitle={`Ksh ${isLoading ? '...' : (calculatedStats?.todayRevenue || 0).toLocaleString()}`}
            icon={ShoppingCart}
            variant="success"
            trend={{ value: 8.2, isPositive: true }}
          />
          <StatCard
            title="Phones In Stock"
            value={isLoading ? '...' : calculatedStats?.phonesInStock || 0}
            subtitle={`${isLoading ? '...' : calculatedStats?.phonesSold || 0} sold this month`}
            icon={Smartphone}
            variant="accent"
          />
          <StatCard
            title="Pending Commissions"
            value={isLoading ? '...' : `Ksh ${(calculatedStats?.pendingCommissions || 0).toLocaleString()}`}
            subtitle="To be paid"
            icon={TrendingUp}
            variant="warning"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <RevenueChart data={transformedChartData} />
          </div>
          {/* Company Performance */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Company Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold text-primary">Ksh {(calculatedStats?.totalRevenue || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-success/10">
                    <p className="text-xs text-muted-foreground mb-1">Total Sales</p>
                    <p className="text-2xl font-bold text-success">{calculatedStats?.totalSales || 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/10">
                    <p className="text-xs text-muted-foreground mb-1">Phones in Stock</p>
                    <p className="text-2xl font-bold text-accent">{calculatedStats?.phonesInStock || 0}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-warning/10">
                    <p className="text-xs text-muted-foreground mb-1">Pending Commissions</p>
                    <p className="text-2xl font-bold text-warning">Ksh {(calculatedStats?.pendingCommissions || 0).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row - Sales by Category */}
        <div className="mb-8">
          <SalesPieChart data={salesByCategoryData} />
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Top Field Officers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : topSellers.length > 0 ? (
                <div className="space-y-3">
                  {topSellers.map((seller, index) => (
                    <div key={seller.userId} className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-primary/10">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{seller.userName || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{seller.salesCount} sales</p>
                          </div>
                        </div>
                        <p className="font-bold text-primary">Ksh {seller.totalRevenue.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No sellers yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Sales */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Recent Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : recentSales.length > 0 ? (
                <div className="space-y-4">
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                        <Smartphone className="h-5 w-5 text-secondary-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{sale.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          {sale.foName || sale.createdByName || 'Unknown'} • {sale.imei ? `IMEI: ${sale.imei.slice(-6)}` : 'Accessory'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">Ksh {sale.saleAmount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sale.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No sales yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
