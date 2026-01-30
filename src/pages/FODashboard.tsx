import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingCart, Smartphone, TrendingUp } from 'lucide-react';

export default function FODashboard() {
  const { sales, commissions, imeis, currentUser, users } = useApp();

  const foSales = sales.filter(s => s.foCode === currentUser?.id || s.createdBy === currentUser?.id);
  const foCommissions = commissions.filter(c => c.foId === currentUser?.id);

  // Get team leader and regional manager info
  const teamLeader = users?.find(u => u.id === currentUser?.teamLeaderId);
  const regionalManager = users?.find(u => u.id === currentUser?.regionalManagerId);

  const totalSales = foSales.reduce((sum, s) => sum + s.saleAmount, 0);
  const totalCommissions = foCommissions.reduce((sum, c) => sum + c.amount, 0);
  const phonesSold = foSales.filter(s => s.imei).length;
  const todaySales = foSales.filter(s => 
    new Date(s.createdAt).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
        <div className="text-sm text-muted-foreground space-y-1 mt-1">
          <p>Welcome back, <span className="font-medium text-foreground">{currentUser?.name}</span></p>
          {teamLeader && (
            <p>Team Leader: <span className="font-medium text-foreground">{teamLeader.name}</span></p>
          )}
          {regionalManager && (
            <p>Regional Manager: <span className="font-medium text-foreground">{regionalManager.name}</span> {currentUser?.region && <span className="text-muted-foreground">({currentUser.region})</span>}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xl font-bold">Ksh {totalSales.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">Ksh {totalCommissions.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Commissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xl font-bold">{phonesSold}</p>
                <p className="text-sm text-muted-foreground">Phones Sold</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xl font-bold">{todaySales}</p>
                <p className="text-sm text-muted-foreground">Today's Sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle>Recent Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {foSales.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No sales yet</p>
          ) : (
            <div className="space-y-3">
              {foSales.slice(0, 5).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{sale.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="font-bold text-success">Ksh {sale.saleAmount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
