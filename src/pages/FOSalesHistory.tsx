import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Receipt, Clock, Download } from 'lucide-react';
import { generateSaleReceipt, exportSales } from '@/lib/pdfGenerator';

export default function FOSalesHistory() {
  const { sales, currentUser } = useApp();

  const foSales = sales.filter(s => s.foCode === currentUser?.id || s.createdBy === currentUser?.id);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Sales History</h1>
          <p className="text-muted-foreground">View your completed sales</p>
        </div>
        <Button variant="outline" onClick={() => exportSales(foSales)}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {foSales.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No sales recorded yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Your Sales ({foSales.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Receipt</th>
                    <th>Product</th>
                    <th>IMEI</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {foSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="text-muted-foreground">
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </td>
                      <td className="font-mono text-sm">{sale.etrReceiptNo}</td>
                      <td className="font-medium">{sale.productName}</td>
                      <td className="font-mono text-sm">{sale.imei || '-'}</td>
                      <td className="font-bold text-success">
                        Ksh {sale.saleAmount.toLocaleString()}
                      </td>
                      <td>
                        <span className={sale.paymentMethod === 'mpesa' ? 'badge-success' : 'badge-info'}>
                          {sale.paymentMethod.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => generateSaleReceipt(sale)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
