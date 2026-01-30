import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/context/AppContext';
import { isSameDay, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  TrendingUp, 
  ShoppingCart, 
  DollarSign, 
  Users, 
  Package,
  Download,
  BarChart3,
  AlertTriangle,
  CalendarIcon,
  FileSpreadsheet,
  Printer,
  Lock
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { exportSalesReportToExcel, printReport } from '@/lib/excelExport';
import { cn } from '@/lib/utils';
import { reportService } from '@/services/reportService';
import { regionService } from '@/services/regionService';

export default function Reports() {
  const { users, currentUser } = useApp();
  
  // Check if user can generate reports (Admin or Regional Manager only)
  const canGenerateReports = currentUser?.role === 'admin' || currentUser?.role === 'regional_manager';
  
  // Get user's region if Regional Manager
  const userRegion = currentUser?.role === 'regional_manager' ? currentUser.region : null;
  
  // Date range state
  const [startDate, setStartDate] = useState<Date>(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }));
  const [endDate, setEndDate] = useState<Date>(endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }));
  
  // Selected regions (Admin can select multiple, RM gets their own region only)
  const [selectedRegions, setSelectedRegions] = useState<string[]>(
    userRegion ? [userRegion] : []
  );

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);

  // Regions state
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  // Report data states
  const [salesData, setSalesData] = useState<any>(null);
  const [commissionsData, setCommissionsData] = useState<any>(null);
  const [inventoryData, setInventoryData] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [companyPerformanceData, setCompanyPerformanceData] = useState<any>(null);
  const [topProductsData, setTopProductsData] = useState<any>(null);
  const [activeFOsData, setActiveFOsData] = useState<any>(null);

  // Toggle region selection
  const toggleRegion = (region: string) => {
    if (userRegion) return; // RM cannot change their region
    
    setSelectedRegions(prev => 
      prev.includes(region) 
        ? prev.filter(r => r !== region)
        : [...prev, region]
    );
  };

  // Select/deselect all regions
  const toggleAllRegions = () => {
    if (userRegion) return;
    
    if (selectedRegions.length === availableRegions.length) {
      setSelectedRegions([]);
    } else {
      setSelectedRegions([...availableRegions]);
    }
  };

  // Load available regions on component mount
  useEffect(() => {
    const loadRegions = async () => {
      try {
        setIsLoadingRegions(true);
        const regions = await regionService.getRegions();
        const regionNames = regions.map((r: any) => r.name);
        setAvailableRegions(regionNames);
      } catch (error) {
        console.error('Failed to load regions:', error);
        setAvailableRegions([]);
      } finally {
        setIsLoadingRegions(false);
      }
    };
    
    loadRegions();
  }, []);

  // Fetch reports data from API with REAL-TIME loading
  const fetchReportsData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Build params including optional region filtering
      const baseParams: any = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      // If the user is a Regional Manager, limit to their region
      if (userRegion) baseParams.region = userRegion;

      // If admin has selected exactly one region, pass it as `region` filter for endpoints that accept it
      const singleRegion = !userRegion && selectedRegions.length === 1 ? selectedRegions[0] : null;
      if (singleRegion) baseParams.region = singleRegion;

      console.log('📊 Fetching reports with params:', baseParams);

      // Fetch all reports in parallel. For endpoints that accept region filter, pass it via params.
      const [salesRes, commissionsRes, inventoryRes, performanceRes, companyRes, productsRes, fosRes] = await Promise.all([
        reportService.getSalesReport(baseParams),
        reportService.getCommissionsReport(baseParams),
        reportService.getInventoryReport(),
        reportService.getPerformanceReport(baseParams),
        reportService.getCompanyPerformance(baseParams),
        reportService.getTopProducts({ ...baseParams, limit: 8 }),
        reportService.getActiveFOs(baseParams),
      ]);

      // Log successful responses
      console.log('✅ Sales data loaded:', salesRes.data?.summary);
      console.log('✅ Commission data loaded:', commissionsRes.data?.byStatus);
      console.log('✅ Inventory data loaded:', inventoryRes.data?.summary);
      console.log('✅ Performance data loaded:', performanceRes.data?.userPerformance?.length, 'FOs');
      console.log('✅ Company performance loaded:', companyRes.data?.companies);

      // If admin selected multiple regions, also fetch a consolidated comprehensive report
      let comprehensiveRes = null;
      if (!userRegion && selectedRegions.length > 1) {
        try {
          comprehensiveRes = await reportService.getComprehensiveReport({
            startDate: baseParams.startDate,
            endDate: baseParams.endDate,
          } as any);
          console.log('📋 Comprehensive report loaded for regions:', selectedRegions);
        } catch (err) {
          console.warn('⚠️ Failed to load comprehensive report:', err);
        }
      }

      // Set all data - API takes priority, will fallback to context if empty
      if (salesRes.success) setSalesData(salesRes.data);
      if (commissionsRes.success) setCommissionsData(commissionsRes.data);
      if (inventoryRes.success) setInventoryData(inventoryRes.data);
      if (performanceRes.success) setPerformanceData(performanceRes.data);
      if (companyRes.success) setCompanyPerformanceData(companyRes.data);
      if (productsRes.success) setTopProductsData(productsRes.data);
      if (fosRes.success) setActiveFOsData(fosRes.data);

      console.log('🔄 Real-time report update complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
      console.error('❌ Error fetching reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data when date range or regions change - REAL-TIME UPDATES
  useEffect(() => {
    if (canGenerateReports) {
      fetchReportsData();
    }
  }, [startDate, endDate, selectedRegions, canGenerateReports, userRegion]);
  // Get sales data from AppContext
  const { sales } = useApp() as any;

  // Context data as fallback
  const contextSales = useMemo(() => {
    if (!Array.isArray(sales)) return [];
    
    return sales.filter((sale: any) => {
      const saleDate = new Date(sale.createdAt);
      if (!isWithinInterval(saleDate, { start: startDate, end: endDate })) return false;
      
      if (userRegion) return sale.region === userRegion;
      if (selectedRegions.length > 0) return selectedRegions.includes(sale.region);
      
      return true;
    });
  }, [startDate, endDate, selectedRegions, userRegion, sales]);

  // Computed stats from API data WITH CONTEXT FALLBACK
  const totalRevenue = useMemo(() => {
    if (salesData?.summary?.totalRevenue) return salesData.summary.totalRevenue;
    // Fallback: calculate from context
    return contextSales.reduce((sum: number, sale: any) => sum + (sale.saleAmount || 0), 0);
  }, [salesData, contextSales]);

  const totalSalesCount = useMemo(() => {
    if (salesData?.summary?.totalSales) return salesData.summary.totalSales;
    // Fallback: calculate from context
    return contextSales.length;
  }, [salesData, contextSales]);

  const totalCommissionsPaid = useMemo(() => {
    if (commissionsData?.byStatus?.find((s: any) => s._id === 'paid')?.total) {
      return commissionsData.byStatus.find((s: any) => s._id === 'paid').total;
    }
    // Fallback: return 0 or calculate from commissions in context if available
    return 0;
  }, [commissionsData]);

  const activeFOs = useMemo(() => {
    if (activeFOsData?.activeFOsCount) return activeFOsData.activeFOsCount;
    // Fallback: count unique FOs with sales in period
    const uniqueFOs = new Set(
      contextSales
        .map((sale: any) => sale.foId || sale.createdBy)
        .filter(Boolean)
    );
    return uniqueFOs.size;
  }, [activeFOsData, contextSales]);

  const totalFOs = activeFOsData?.totalFOs || users.length;

  // Top selling products from API WITH CONTEXT FALLBACK
  const topProducts = useMemo(() => {
    if (topProductsData?.products && Array.isArray(topProductsData.products)) {
      return topProductsData.products.map((p: any) => ({
        name: p.productName,
        value: p.totalRevenue,
      }));
    }
    
    // Fallback: aggregate from context sales
    const productMap = new Map<string, number>();
    contextSales.forEach((sale: any) => {
      const productName = sale.productName || 'Unknown Product';
      const current = productMap.get(productName) || 0;
      productMap.set(productName, current + (sale.saleAmount || 0));
    });
    
    return Array.from(productMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [topProductsData, contextSales]);

  // FO Performance from API WITH CONTEXT FALLBACK
  const foData = useMemo(() => {
    if (performanceData?.userPerformance && Array.isArray(performanceData.userPerformance)) {
      return performanceData.userPerformance
        .sort((a: any, b: any) => (b.revenue || 0) - (a.revenue || 0))
        .slice(0, 5)
        .map((fo: any) => ({
          name: fo.userName || fo.foName || 'Unknown',
          sales: fo.revenue || 0,
          commissions: fo.commissions || 0,
        }));
    }
    
    // Fallback: aggregate from context sales
    const foMap = new Map<string, { sales: number; count: number }>();
    contextSales.forEach((sale: any) => {
      const foId = sale.foId || sale.createdBy;
      const foUser = users.find(u => u.id === foId);
      const foName = foUser?.name || 'Unknown';
      
      const current = foMap.get(foId) || { sales: 0, count: 0 };
      foMap.set(foId, {
        sales: current.sales + (sale.saleAmount || 0),
        count: current.count + 1,
      });
    });
    
    return Array.from(foMap.entries())
      .map(([foId, data]) => ({
        name: users.find(u => u.id === foId)?.name || 'Unknown',
        sales: data.sales,
        commissions: 0, // Can't calculate from context, would need commission data
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
  }, [performanceData, contextSales, users]);

  // Company performance breakdown WITH CONTEXT FALLBACK
  const companyPerformance = useMemo(() => {
    if (companyPerformanceData?.companies && Array.isArray(companyPerformanceData.companies)) {
      return companyPerformanceData.companies
        .map((c: any) => ({
          name: c.name,
          value: c.percentage,
          revenue: c.totalRevenue,
          sales: c.salesCount,
        }));
    }
    
    // Fallback: aggregate from context sales by source
    const sourceMap = new Map<string, { revenue: number; count: number }>();
    contextSales.forEach((sale: any) => {
      const source = sale.source || 'Watu'; // Default to Watu
      const current = sourceMap.get(source) || { revenue: 0, count: 0 };
      sourceMap.set(source, {
        revenue: current.revenue + (sale.saleAmount || 0),
        count: current.count + 1,
      });
    });
    
    const totalRev = Array.from(sourceMap.values()).reduce((sum, d) => sum + d.revenue, 0);
    
    return Array.from(sourceMap.entries())
      .map(([source, data]) => ({
        name: source.charAt(0).toUpperCase() + source.slice(1),
        value: totalRev > 0 ? Math.round((data.revenue / totalRev) * 100) : 0,
        revenue: data.revenue,
        sales: data.count,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [companyPerformanceData, contextSales]);

  const COMPANY_COLORS = ['#10b981', '#8b5cf6', '#f97316'];

  // Inventory summary from API
  const totalProducts = inventoryData?.summary?.totalDevices || 0;
  const totalStock = inventoryData?.summary?.inStock || 0;
  const lowStockItems = inventoryData?.lowStock?.length || 0;

  const categoryBreakdown = useMemo(() => {
    if (!inventoryData?.byProduct) return [];
    
    const phones = inventoryData.byProduct
      .filter((p: any) => {
        const category = (p.category || '').toLowerCase();
        return category.includes('phone') || category.includes('smartphone') || category.includes('tablet');
      })
      .reduce((sum: number, p: any) => sum + (p.inStock || 0), 0);
    
    const accessories = inventoryData.byProduct
      .filter((p: any) => {
        const category = (p.category || '').toLowerCase();
        return category.includes('accessory') || category.includes('sim') || category.includes('airtime');
      })
      .reduce((sum: number, p: any) => sum + (p.inStock || 0), 0);

    return [
      { name: 'Phones', count: phones },
      { name: 'Accessories', count: accessories },
    ];
  }, [inventoryData]);

  // Handle export to Excel with real data
  const handleExportExcel = async () => {
    try {
      setIsLoading(true);
      const regionsToExport = userRegion ? [userRegion] : selectedRegions.length > 0 ? selectedRegions : [];
      
      // Prepare sales data for export from context
      const salesForExport = contextSales.map((sale: any) => ({
        date: new Date(sale.createdAt).toLocaleDateString('en-KE'),
        time: new Date(sale.createdAt).toLocaleTimeString('en-KE'),
        foName: sale.foName || users.find(u => u.id === (sale.foId || sale.createdBy))?.name || 'Unknown',
        foCode: sale.foCode || users.find(u => u.id === (sale.foId || sale.createdBy))?.foCode || 'N/A',
        region: sale.region || 'N/A',
        productName: sale.productName || 'Unknown Product',
        imei: sale.imei || 'N/A',
        quantity: sale.quantity || 1,
        amount: sale.saleAmount || 0,
        paymentMethod: sale.paymentMethod || 'Cash',
        clientName: sale.clientName || 'N/A',
        clientPhone: sale.clientPhone || 'N/A',
        source: sale.source || 'Watu',
      })) as any;

      // Export with real data
      exportSalesReportToExcel(salesForExport, [], users, startDate, endDate, regionsToExport);
    } catch (error) {
      console.error('Error exporting report:', error);
      setError('Failed to export report. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle print with real data
  const handlePrint = async () => {
    try {
      const regionsToPrint = userRegion ? [userRegion] : selectedRegions.length > 0 ? selectedRegions : [];
      
      // Prepare sales data for print from context
      const salesForPrint = contextSales.map((sale: any) => ({
        date: new Date(sale.createdAt).toLocaleDateString('en-KE'),
        foName: sale.foName || users.find(u => u.id === (sale.foId || sale.createdBy))?.name || 'Unknown',
        productName: sale.productName || 'Unknown Product',
        imei: sale.imei || 'N/A',
        amount: sale.saleAmount || 0,
        region: sale.region || 'N/A',
      })) as any;
      
      printReport(salesForPrint, [], users, startDate, endDate, regionsToPrint);
    } catch (error) {
      console.error('Error printing report:', error);
    }
  };

  // If user doesn't have permission to generate reports
  if (!canGenerateReports) {
    return (
      <MainLayout>
        <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Lock className="h-16 w-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Access Restricted</h1>
          <p className="text-muted-foreground max-w-md">
            Only Admin and Regional Managers can generate and view reports. 
            Please contact your supervisor for access.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-medium text-destructive">Error loading reports</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <p className="text-sm text-primary">Loading reports data...</p>
          </div>
        )}
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              {userRegion 
                ? `View sales performance for ${userRegion} Region`
                : 'View sales performance, inventory status, and FO metrics'
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button variant="default" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print Report
            </Button>
          </div>
        </div>

        {/* Filters Section */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(endDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="text-sm text-muted-foreground">
                Period: {format(startDate, 'do MMM')} – {format(endDate, 'do MMM yyyy')}
              </div>
            </div>

            {/* Region Selection (Admin only) */}
            {!userRegion && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Regions</Label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={toggleAllRegions}
                    className="text-xs"
                    disabled={isLoadingRegions || availableRegions.length === 0}
                  >
                    {selectedRegions.length === availableRegions.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {isLoadingRegions ? (
                    <p className="text-sm text-muted-foreground">Loading regions...</p>
                  ) : availableRegions.length > 0 ? (
                    availableRegions.map(region => (
                      <div key={region} className="flex items-center space-x-2">
                        <Checkbox
                          id={region}
                          checked={selectedRegions.includes(region)}
                          onCheckedChange={() => toggleRegion(region)}
                        />
                        <Label 
                          htmlFor={region} 
                          className={cn(
                            "text-sm cursor-pointer",
                            selectedRegions.includes(region) ? "text-foreground font-medium" : "text-muted-foreground"
                          )}
                        >
                          {region}
                        </Label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No regions available</p>
                  )}
                </div>
                {selectedRegions.length === 0 && availableRegions.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    No regions selected. Report will include all regions.
                  </p>
                )}
              </div>
            )}

            {/* Regional Manager - Show their region */}
            {userRegion && (
              <div className="flex items-center gap-2 bg-muted/50 p-3 rounded-lg">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Viewing data for: <span className="font-medium text-foreground">{userRegion} Region</span>
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-foreground">Ksh {totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Selected period</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-primary font-medium">Total Sales</p>
                  <p className="text-2xl font-bold text-foreground">{totalSalesCount}</p>
                  <p className="text-xs text-muted-foreground">Transactions</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-success font-medium">Commissions Paid</p>
                  <p className="text-2xl font-bold text-foreground">Ksh {totalCommissionsPaid.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Selected period</p>
                </div>
                <DollarSign className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-accent font-medium">Active FOs</p>
                  <p className="text-2xl font-bold text-foreground">{activeFOs}</p>
                  <p className="text-xs text-muted-foreground">of {totalFOs} total</p>
                </div>
                <Users className="h-8 w-8 text-accent" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Selling Products */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-success" />
                Top Selling Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => `Ksh ${value.toLocaleString()}`}
                      labelFormatter={(label: string) => `Product: ${label}`}
                    />
                    <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No sales data for selected period
                </div>
              )}
            </CardContent>
          </Card>

          {/* FO Performance */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-accent" />
                Field Officer Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {foData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={foData} margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => `Ksh ${value.toLocaleString()}`} />
                    <Bar dataKey="sales" fill="#8b5cf6" name="Sales" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="commissions" fill="#f97316" name="Commissions" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No FO data for selected period
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Performance */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Company Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {companyPerformance.length > 0 ? (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsPie>
                      <Pie
                        data={companyPerformance}
                        cx="35%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {companyPerformance.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COMPANY_COLORS[index % COMPANY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        formatter={(value, entry: any) => (
                          <span className="text-foreground">
                            {value} <span className="font-bold ml-4">{entry.payload.value}%</span>
                          </span>
                        )}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No company data for selected period
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inventory Summary */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-success" />
                Inventory Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Products</p>
                  <p className="text-3xl font-bold text-foreground">{totalProducts}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Total Stock Units</p>
                  <p className="text-3xl font-bold text-foreground">{totalStock}</p>
                </div>
              </div>

              {lowStockItems > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">{lowStockItems} items need restocking</span>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">By Category</p>
                {categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-muted-foreground">{cat.name}</span>
                    <span className="font-medium">{cat.count} units</span>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full" onClick={handleExportExcel}>
                <Download className="h-4 w-4 mr-2" />
                Export Full Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
