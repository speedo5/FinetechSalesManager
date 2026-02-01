import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Receipt, Clock, Download } from 'lucide-react';
import { generateSaleReceipt, exportSales } from '@/lib/pdfGenerator';
import { useEffect, useState } from 'react';
import { salesService } from '@/services/salesService';

export default function FOSalesHistory() {
  const { sales, setSales, currentUser } = useApp();
  const [foSalesData, setFoSalesData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load FO sales on component mount
  useEffect(() => {
    const loadSalesData = async () => {
      if (!currentUser?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Fetch FO-specific sales
        const salesRes = await salesService.getAll({ foId: currentUser.id });
        let loadedSales: any[] = [];
        
        if (Array.isArray(salesRes)) {
          loadedSales = salesRes;
        } else if ((salesRes as any)?.data) {
          loadedSales = Array.isArray((salesRes as any).data)
            ? (salesRes as any).data
            : (salesRes as any).data.sales || [];
        }

        // Update both context and local state
        if (loadedSales.length > 0) {
          setSales(loadedSales);
        }
        
        setFoSalesData(loadedSales);
        console.log('Loaded FO sales:', loadedSales.length);
      } catch (err) {
        console.error('Error loading sales history:', err);
        setFoSalesData([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadSalesData();
  }, [currentUser?.id, setSales]);

  // Use loaded data or fall back to context
  const foSales = foSalesData.length > 0 ? foSalesData : sales.filter(s => (s as any).foId === currentUser?.id || (s as any).foCode === currentUser?.id || (s as any).createdBy === currentUser?.id);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Sales History</h1>
          <p className="text-muted-foreground">View your completed sales</p>
        </div>
        <Button variant="outline" onClick={() => foSales.length > 0 && exportSales(foSales)} disabled={foSales.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {isLoading ? (
        <Card className="border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading your sales history...</p>
          </CardContent>
        </Card>
      ) : foSales.length === 0 ? (
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
                  {foSales.map((sale, idx) => {
                    const saleAny = sale as any;
                    const saleDate = saleAny.createdAt ? new Date(saleAny.createdAt) : null;
                    const saleAmount = saleAny.saleAmount ?? saleAny.totalAmount ?? saleAny.amount ?? 0;
                    const paymentMethod = saleAny.paymentMethod || 'cash';
                    
                    return (
                      <tr key={sale.id || idx}>
                        <td className="text-muted-foreground">
                          {saleDate ? saleDate.toLocaleDateString() : '—'}
                        </td>
                        <td className="font-mono text-sm">{saleAny.etrReceiptNo || saleAny.receiptNo || '—'}</td>
                        <td className="font-medium">{saleAny.productName || 'Sale'}</td>
                        <td className="font-mono text-sm">{saleAny.imei || '—'}</td>
                        <td className="font-bold text-success">
                          Ksh {saleAmount.toLocaleString()}
                        </td>
                        <td>
                          <span className={paymentMethod === 'mpesa' ? 'badge-success' : 'badge-info'}>
                            {paymentMethod.toUpperCase()}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
