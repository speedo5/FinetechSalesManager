import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, CheckCircle, Clock, Download, TrendingUp } from 'lucide-react';
import { exportCommissions } from '@/lib/pdfGenerator';

export default function FOCommissions() {
  const { commissions, currentUser } = useApp();

  // Filter commissions for this FO only
  const foCommissions = commissions.filter(c => c.userId === currentUser?.id);
  const totalEarned = foCommissions.reduce((sum, c) => sum + c.amount, 0);
  const paidAmount = foCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
  const pendingAmount = foCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);

  // Group by sale for a better view
  const salesWithCommissions = foCommissions.reduce((acc, c) => {
    if (!acc[c.saleId]) {
      acc[c.saleId] = {
        saleId: c.saleId,
        productName: c.productName,
        imei: c.imei,
        amount: c.amount,
        status: c.status,
        createdAt: c.createdAt,
        paidAt: c.paidAt,
      };
    }
    return acc;
  }, {} as Record<string, any>);

  const commissionList = Object.values(salesWithCommissions).sort((a: any, b: any) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">My Commissions</h1>
          <p className="text-muted-foreground">Track your earnings from phone sales</p>
        </div>
        <Button variant="outline" onClick={() => exportCommissions(foCommissions)}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">Ksh {totalEarned.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Earned</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success">Ksh {paidAmount.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Paid Out</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">Ksh {pendingAmount.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Records */}
      <Card className="border shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Commission History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {commissionList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No commissions yet</p>
              <p className="text-sm text-muted-foreground mt-1">Complete phone sales to earn commissions</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>IMEI</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Paid On</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionList.map((commission: any) => (
                    <tr key={commission.saleId}>
                      <td className="text-muted-foreground">
                        {new Date(commission.createdAt).toLocaleDateString()}
                      </td>
                      <td className="font-medium">{commission.productName}</td>
                      <td className="font-mono text-sm">{commission.imei || '-'}</td>
                      <td className="font-bold text-success">Ksh {commission.amount.toLocaleString()}</td>
                      <td>
                        {commission.status === 'paid' ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Paid
                          </Badge>
                        ) : commission.status === 'reversed' ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                            Reversed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="text-muted-foreground">
                        {commission.paidAt ? new Date(commission.paidAt).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
