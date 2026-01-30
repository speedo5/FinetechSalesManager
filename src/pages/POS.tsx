import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { generateSaleReceipt, generateReceiptNumber } from '@/lib/pdfGenerator';
import { Sale, PaymentMethod, PhoneSource, Commission } from '@/types';
import { useSearchParams } from 'react-router-dom';
import { productService } from '@/services/productService';
import { imeiService } from '@/services/imeiService';
import { salesService } from '@/services/salesService';
import { userService } from '@/services/userService';
import { ApiClientError } from '@/services/apiClient';
import { toast as sonnerToast } from 'sonner';
import { 
  ShoppingCart, 
  Search, 
  CheckCircle, 
  AlertCircle,
  Receipt,
  Smartphone,
  Package,
  Wallet,
  Filter,
  User,
  Building2,
  Download
} from 'lucide-react';

export default function POS() {
  const { currentUser, addNotification, logActivity } = useApp();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  // API Data state
  const [loadedProducts, setLoadedProducts] = useState<any[]>([]);
  const [loadedImeis, setLoadedImeis] = useState<any[]>([]);
  const [fieldOfficers, setFieldOfficers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [imeiSearch, setImeiSearch] = useState('');
  const [selectedImei, setSelectedImei] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [selectedFO, setSelectedFO] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<PhoneSource>('watu');
  
  // Client details
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientIdNumber, setClientIdNumber] = useState('');
  
  // Check if current user can print receipts (Admin, Regional Manager, or Team Leader)
  const canPrintReceipt = currentUser?.role === 'admin' || currentUser?.role === 'regional_manager' || currentUser?.role === 'team_leader';

  // Load products, IMEIs, and field officers from APIs
  // Helper to normalize IMEI responses from various API shapes
  const parseImeisResponse = (res: any): any[] => {
    if (!res) return [];
    if (Array.isArray(res)) return res as any[];
    if (res.data) {
      if (Array.isArray(res.data)) return res.data;
      if (res.data.imeis && Array.isArray(res.data.imeis)) return res.data.imeis;
    }
    if (res.imeis && Array.isArray(res.imeis)) return res.imeis;
    return [];
  };

  // Merge and dedupe IMEIs by imei string
  const mergeImeis = (lists: any[][]) => {
    const map = new Map<string, any>();
    lists.flat().forEach(i => {
      if (i && i.imei) map.set(i.imei, { ...map.get(i.imei), ...i });
    });
    return Array.from(map.values());
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load products and field officers in parallel
        const [productsRes, foRes] = await Promise.all([
          productService.getAll(),
          userService.getAll({ role: 'field_officer' }),
        ]);

        const products = Array.isArray(productsRes) ? productsRes : (productsRes as any)?.data || [];
        const fos = Array.isArray(foRes) ? foRes : (foRes as any)?.data || [];

        // Always load IN_STOCK items
        const inStockRes = await imeiService.getAll({ status: 'IN_STOCK' });
        const inStockImeis = parseImeisResponse(inStockRes);

        // For roles that sell from allocated stock, also load their allocated IMEIs
        let allocatedImeis: any[] = [];
        if (currentUser?.role === 'field_officer' || currentUser?.role === 'team_leader' || currentUser?.role === 'regional_manager') {
          try {
            const allocatedRes = await imeiService.getAll({ status: 'ALLOCATED', currentHolderId: currentUser.id });
            allocatedImeis = parseImeisResponse(allocatedRes);
          } catch (e) {
            // Fallback: try loading unfiltered ALLOCATED and filter client-side
            const fallbackRes = await imeiService.getAll({ status: 'ALLOCATED' });
            allocatedImeis = parseImeisResponse(fallbackRes).filter((i: any) => {
              const ownerRef = i.currentOwnerId || i.currentHolderId;
              const ownerId = ownerRef?._id || ownerRef?.id || ownerRef;
              return ownerId === currentUser.id;
            });
          }
        }

        // Merge and dedupe
        const allImeis = mergeImeis([inStockImeis, allocatedImeis]);

        console.log('Products loaded:', products.length, products);
        console.log('Loaded IMEIs - inStock:', inStockImeis.length, 'allocated:', allocatedImeis.length, 'merged:', allImeis.length);

        setLoadedProducts(products);
        setLoadedImeis(allImeis);
        setFieldOfficers(fos);
      } catch (error) {
        console.error('Error loading data:', error);
        const errorMsg = error instanceof ApiClientError ? error.getDisplayMessage() : 'Failed to load products and IMEIs';
        sonnerToast.error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentUser?.role]);

  // When admin selects a Field Officer, fetch that FO's allocated IMEIs so admin can sell on their behalf
  useEffect(() => {
    const loadAllocatedForFO = async () => {
      if (currentUser?.role !== 'admin' || !selectedFO) return;
      try {
        setIsLoading(true);
        const allocatedRes = await imeiService.getAll({ status: 'ALLOCATED', currentHolderId: selectedFO });
        const allocatedImeis = parseImeisResponse(allocatedRes);

        // Merge with existing loadedImeis and dedupe
        setLoadedImeis(prev => mergeImeis([prev, allocatedImeis]));
      } catch (error) {
        console.error('Error loading allocated IMEIs for selected FO:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllocatedForFO();
  }, [selectedFO, currentUser?.role]);

  // Handle URL params for pre-selecting product/IMEI from inventory
  useEffect(() => {
    const imeiParam = searchParams.get('imei');
    const productParam = searchParams.get('product');
    
    if (productParam) {
      setSelectedProduct(productParam);
    }
    if (imeiParam) {
      setSelectedImei(imeiParam);
    }
  }, [searchParams]);

  // Filter products based on search and category (use loaded data from API)
  const filteredProducts = loadedProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
    let matchesCategory = true;
    
    if (categoryFilter === 'all') {
      matchesCategory = true;
    } else if (categoryFilter === 'Smartphones') {
      matchesCategory = p.category === 'Smartphones' || p.category === 'Feature Phones' || p.category === 'Tablets';
    } else if (categoryFilter === 'Accessories') {
      matchesCategory = p.category === 'Accessories' || p.category === 'SIM Cards' || p.category === 'Airtime';
    }
    
    return matchesSearch && matchesCategory;
  });

  const phoneProducts = filteredProducts.filter(p => p.category === 'Smartphones' || p.category === 'Feature Phones' || p.category === 'Tablets');
  const accessoryProducts = filteredProducts.filter(p => p.category === 'Accessories' || p.category === 'SIM Cards' || p.category === 'Airtime');

  const product = loadedProducts.find(p => p.id === selectedProduct);
  const isPhone = product?.category === 'Smartphones' || product?.category === 'Feature Phones' || product?.category === 'Tablets';
  

  const selectedImeiData = loadedImeis.find(i => i.imei === selectedImei);
  const selectedFOData = fieldOfficers.find(u => u.id === selectedFO);
  const saleAmount = selectedImeiData?.sellingPrice || (product?.price || 0) * quantity;

  // Determine the effective seller (either the selected FO when admin is acting on their behalf, or the current user)
  const effectiveSellerId = selectedFO || currentUser?.id;
  const effectiveSellerRole = selectedFO ? (selectedFOData?.role || 'field_officer') : currentUser?.role;
  const mustUseAllocatedRoles = ['field_officer', 'team_leader', 'regional_manager'];

  const availableImeis = loadedImeis.filter(i => {
    // productId can be either string ID or populated object
    const productId = typeof i.productId === 'string' ? i.productId : i.productId?._id || i.productId?.id;
    const matchesProduct = productId === selectedProduct;
    const matchesSearch = !imeiSearch || i.imei.includes(imeiSearch) || i.productName?.toLowerCase().includes(imeiSearch.toLowerCase());

    // parsed owner id (handle APIs that use either currentOwnerId or currentHolderId)
    const ownerRef = i.currentOwnerId || i.currentHolderId;
    const ownerId = ownerRef?._id || ownerRef?.id || ownerRef;
    const isAllocated = i.status === 'ALLOCATED' || i.status === 'allocated';
    const isInStock = i.status === 'IN_STOCK' || i.status === 'in_stock';

    // If the effective seller is an FO/TL/RM (or admin acting on behalf of an FO), they must sell from allocated items that belong to them
    if (mustUseAllocatedRoles.includes(effectiveSellerRole) || (currentUser?.role === 'admin' && selectedFO)) {
      const isAllocatedToSeller = isAllocated && ownerId === effectiveSellerId;
      if (matchesProduct && matchesSearch) {
        console.log('Allocation Filter Check:', {
          imei: i.imei,
          status: i.status,
          ownerId,
          effectiveSellerId,
          effectiveSellerRole,
          isAllocatedToSeller,
        });
      }
      return matchesProduct && matchesSearch && isAllocatedToSeller;
    }

    // Otherwise (e.g., admin selling without selecting an FO), require IN_STOCK items
    return matchesProduct && matchesSearch && isInStock;
  });

  // Get commission config from IMEI or product
  const commissionConfig = selectedImeiData?.commissionConfig || product?.commissionConfig;
  const totalCommission = commissionConfig 
    ? commissionConfig.foCommission + commissionConfig.teamLeaderCommission + commissionConfig.regionalManagerCommission
    : 0;

  const canCompleteSale = () => {
    if (!selectedProduct) return false;
    if (isPhone && !selectedImei) return false;
    if (!isPhone && quantity < 1) return false;
    return true;
  };

  const completeSale = async () => {
    if (!canCompleteSale() || !product) {
      sonnerToast.error('Please fill all required fields');
      return;
    }

    // Validate IMEI for phones only
    if (isPhone) {
      if (!selectedImei) {
        sonnerToast.error('Please select a valid phone IMEI');
        return;
      }

      if (!selectedImeiData) {
        console.error('Selected IMEI not found in loadedImeis:', {
          selectedImei,
          loadedImeis: loadedImeis.map(i => ({ imei: i.imei, id: i.id })),
        });
        sonnerToast.error('Invalid IMEI selected. Please select another phone.');
        return;
      }
    }

    // For phones, get IMEI ID; for accessories, imeiId is optional
    const imeiId = isPhone ? (selectedImeiData?._id || selectedImeiData?.id || selectedImei) : undefined;
    
    if (isPhone && !imeiId) {
      sonnerToast.error('Cannot determine IMEI ID. Please select another phone.');
      return;
    }

    // Enforcement: ensure effective seller can sell this IMEI
    const effectiveSellerIdLocal = selectedFO || currentUser?.id;
    const effectiveSellerRoleLocal = selectedFO ? (selectedFOData?.role || 'field_officer') : currentUser?.role;
    const mustUseAllocatedLocal = ['field_officer', 'team_leader', 'regional_manager'];

    if (isPhone && selectedImeiData) {
      const ownerRef = selectedImeiData.currentOwnerId || selectedImeiData.currentHolderId;
      const ownerId = ownerRef?._id || ownerRef?.id || ownerRef;
      const isAllocatedStatus = selectedImeiData.status === 'ALLOCATED' || selectedImeiData.status === 'allocated';

      // If seller must use allocated items (or admin is selling on behalf of a selected FO), enforce allocation ownership
      if (mustUseAllocatedLocal.includes(effectiveSellerRoleLocal) || (currentUser?.role === 'admin' && selectedFO)) {
        if (!isAllocatedStatus || ownerId !== effectiveSellerIdLocal) {
          sonnerToast.error('Selected IMEI is not allocated to the selling account. Please select an IMEI allocated to you or to the selected Field Officer.');
          return;
        }
      } else if (currentUser?.role === 'admin' && !selectedFO) {
        // Admin selling without selecting an FO must use IN_STOCK items
        const isInStock = selectedImeiData.status === 'IN_STOCK' || selectedImeiData.status === 'in_stock';
        if (!isInStock) {
          sonnerToast.error('Admin sales must use in-stock items. Please select an in-stock IMEI or clear the Field Officer selection.');
          return;
        }
      }
    }

    try {
      setIsSaving(true);

      // Prepare sale data for API
      const paymentMethodMap: Record<string, string> = {
        'cash': 'cash',
        'mpesa': 'mpesa',
        'bank': 'mpesa',
        'credit': 'mpesa'
      };

      const saleData: any = {
        paymentMethod: paymentMethodMap[paymentMethod] || 'cash',
        paymentReference: paymentReference || undefined,
        customerName: clientName || 'Walk-in Customer',
        customerPhone: clientPhone || '',
        customerIdNumber: clientIdNumber || '',
        customerEmail: '',
        notes: clientIdNumber || '',
        // Add seller/FO information
        foId: selectedFO || undefined,
        foName: selectedFOData?.name || currentUser?.name || 'Admin',
        foCode: selectedFOData?.code || undefined,
        source: selectedSource || 'watu',
        sellerName: selectedFOData?.name || currentUser?.name || 'Admin',
        sellerRole: selectedFOData?.role || currentUser?.role || 'admin',
      };

      // Add imeiId for phones, productId + quantity for accessories
      if (isPhone && imeiId) {
        saleData.imeiId = imeiId;
        console.log('Sending phone sale with imeiId:', imeiId);
      } else if (!isPhone) {
        saleData.productId = selectedProduct;
        saleData.quantity = quantity;
        console.log('Sending accessory sale with productId:', selectedProduct, 'quantity:', quantity);
      }

      console.log('Sale data being sent:', saleData);

      // Create sale via API
      const createdSaleRes = await salesService.create(saleData);
      
      if (!createdSaleRes?.data) {
        throw new Error('Failed to create sale');
      }

      const createdSale = createdSaleRes.data;

      // Refresh IMEIs data to reflect updated status
      if (isPhone && selectedImei) {
        try {
          const updatedImeisResponse = await imeiService.getAll();
          let updatedImeis = [];
          
          if (updatedImeisResponse && typeof updatedImeisResponse === 'object') {
            if ((updatedImeisResponse as any).imeis && Array.isArray((updatedImeisResponse as any).imeis)) {
              updatedImeis = (updatedImeisResponse as any).imeis;
            } else if (Array.isArray((updatedImeisResponse as any).data)) {
              updatedImeis = (updatedImeisResponse as any).data;
            } else if (Array.isArray(updatedImeisResponse)) {
              updatedImeis = updatedImeisResponse as any;
            }
          }
          
          setLoadedImeis(updatedImeis);
        } catch (refreshError) {
          console.error('Error refreshing IMEIs:', refreshError);
          // Don't fail the entire sale if refresh fails
        }
      }

      // Note: Commissions are automatically generated by the backend when a sale is created
      // Log commission activity
      if (isPhone && selectedFO) {
        logActivity('commission', 'Commissions Generated', 
          `Commissions generated for sale of ${product.name}`,
          { saleId: createdSale.id, totalCommission }
        );
      }

      // Add notification
      addNotification({
        title: 'Sale Completed',
        message: `Sale of ${quantity > 1 ? quantity + ' x ' : ''}${product.name}${selectedImei ? ` (IMEI: ${selectedImei.slice(-6)})` : ''} has been recorded`,
        type: 'sale',
      });

      sonnerToast.success(`Receipt generated. Amount: Ksh ${saleAmount.toLocaleString()}`);

      // Generate and automatically download PDF receipt (for phones only)
      if (isPhone) {
        try {
          // Ensure sellerName, sellerRole, and client details are present in the sale object for the receipt
          const saleForReceipt = {
            ...createdSale,
            sellerName: saleData.sellerName,
            sellerRole: saleData.sellerRole,
            clientName: saleData.customerName,
            clientPhone: saleData.customerPhone,
            clientIdNumber: saleData.customerIdNumber,
          };
          generateSaleReceipt(saleForReceipt);
          // Auto-download hint for user
          if (canPrintReceipt) {
            sonnerToast.success('Receipt downloaded. You can print it from your downloads folder.');
          }
        } catch (pdfError) {
          console.error('Error generating PDF receipt:', pdfError);
          sonnerToast.error('Could not generate receipt PDF, but sale was recorded');
        }
      }

      // Log activity
      logActivity('sale', 'Sale Completed', 
        `${currentUser?.name} sold ${quantity > 1 ? quantity + ' x ' : ''}${product.name}${selectedImei ? ` (IMEI: ${selectedImei.slice(-6)})` : ''}`,
        { saleId: createdSale.id, amount: saleAmount }
      );

      // Reset form
      setSelectedProduct('');
      setImeiSearch('');
      setSelectedImei(null);
      setQuantity(1);
      setPaymentReference('');
      setSelectedFO('');
      setSelectedSource('watu');
      setClientName('');
      setClientPhone('');
      setClientIdNumber('');
    } catch (error) {
      // Extract detailed error information
      let errorTitle = 'Error';
      let errorMessage = 'Failed to complete sale';
      let detailedLog = '';

      if (error instanceof ApiClientError) {
        errorTitle = `Error (${error.statusCode || 'Network'})`;
        errorMessage = error.getDisplayMessage();
        detailedLog = error.getDetailedInfo();
        
        // Log detailed error info to console for debugging
        console.error('Sale completion error details:');
        console.error('Status Code:', error.statusCode);
        console.error('Message:', error.message);
        console.error('Response Body:', error.responseBody);
        console.error('Full Details:', detailedLog);
      } else if (error instanceof Error) {
        errorMessage = error.message;
        detailedLog = error.toString();
        console.error('Error completing sale:', error);
      } else {
        detailedLog = String(error);
        console.error('Unknown error completing sale:', error);
      }

      // Show user-friendly error message
      sonnerToast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-foreground">Point of Sale</h1>
            <p className="text-sm text-muted-foreground">
              {currentUser?.role === 'team_leader' 
                ? `Selling from allocated stock (${availableImeis.length} items available)`
                : 'Process sales and generate receipts'}
            </p>
          </div>
          {currentUser?.role === 'team_leader' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setIsLoading(true);
                // Reload inventory
                const loadData = async () => {
                  try {
                    const [productsRes, imeisRes, foRes] = await Promise.all([
                      productService.getAll(),
                      imeiService.getAll({}),
                      userService.getAll({ role: 'field_officer' }),
                    ]);
                    
                    const products = Array.isArray(productsRes) ? productsRes : (productsRes as any)?.data || [];
                    let imeis: any[] = [];
                    
                    if (imeisRes) {
                      if ((imeisRes as any).data) {
                        const dataField = (imeisRes as any).data;
                        if (Array.isArray(dataField)) {
                          imeis = dataField;
                        } else if (dataField.imeis && Array.isArray(dataField.imeis)) {
                          imeis = dataField.imeis;
                        }
                      } else if ((imeisRes as any).imeis && Array.isArray((imeisRes as any).imeis)) {
                        imeis = (imeisRes as any).imeis;
                      } else if (Array.isArray(imeisRes)) {
                        imeis = imeisRes as any;
                      }
                    }
                    
                    const fos = Array.isArray(foRes) ? foRes : (foRes as any)?.data || [];
                    
                    setLoadedProducts(products);
                    setLoadedImeis(imeis);
                    setFieldOfficers(fos);
                    sonnerToast.success('Inventory refreshed');
                  } catch (error) {
                    sonnerToast.error('Failed to refresh inventory');
                  } finally {
                    setIsLoading(false);
                  }
                };
                loadData();
              }}
              disabled={isLoading}
            >
              {isLoading ? 'Loading...' : 'Refresh Allocated Stock'}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Sale Form */}
          <div className="lg:col-span-2 space-y-4 lg:space-y-6">
            {/* Product Search & Filter */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Select Product
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Search Bar */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={(v: string) => setCategoryFilter(v)}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem key="all" value="all">All</SelectItem>
                      <SelectItem key="Smartphones" value="Smartphones">Phones</SelectItem>
                      <SelectItem key="Accessories" value="Accessories">Accessories</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(categoryFilter === 'all' || categoryFilter === 'phone') && phoneProducts.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Phones</Label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {phoneProducts.map((prod) => {
                          // Determine effective seller (selected FO when admin acts on their behalf, otherwise current user)
                          const effectiveSellerIdForCount = selectedFO || currentUser?.id;
                          const effectiveSellerRoleForCount = selectedFO ? (selectedFOData?.role || 'field_officer') : currentUser?.role;
                          const mustUseAllocatedForCount = ['field_officer', 'team_leader', 'regional_manager'];

                          const availableCount = loadedImeis.filter(i => {
                            // productId can be either string ID or populated object
                            const productId = typeof i.productId === 'string' ? i.productId : i.productId?._id || i.productId?.id;
                            const matchesProduct = productId === prod.id;

                            // Resolve owner (support currentOwnerId or currentHolderId from API)
                            const ownerRef = i.currentOwnerId || i.currentHolderId;
                            const ownerId = ownerRef?._id || ownerRef?.id || ownerRef;

                            const isAllocated = i.status === 'ALLOCATED' || i.status === 'allocated';
                            const isInStock = i.status === 'IN_STOCK' || i.status === 'in_stock';

                            // If seller must sell their allocated stock (FO/TL/RM) or admin selecting FO, count only allocated to them
                            if (mustUseAllocatedForCount.includes(effectiveSellerRoleForCount) || (currentUser?.role === 'admin' && selectedFO)) {
                              const isAllocatedToSeller = isAllocated && ownerId === effectiveSellerIdForCount;
                              if (matchesProduct && isAllocatedToSeller) {
                                return true;
                              }
                              return false;
                            }

                            // Otherwise count in-stock
                            return matchesProduct && isInStock;
                          }).length;
                          return (
                            <button
                              key={prod.id}
                              onClick={() => { setSelectedProduct(prod.id); setSelectedImei(null); }}
                              disabled={availableCount === 0}
                              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                                selectedProduct === prod.id
                                  ? 'border-primary bg-primary/5'
                                  : availableCount === 0
                                    ? 'border-border bg-muted/50 opacity-50'
                                    : 'border-border hover:border-primary/50'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium text-foreground text-sm truncate">{prod.name}</p>
                                  <p className="text-xs text-muted-foreground">Ksh {prod.price.toLocaleString()}</p>
                                </div>
                              </div>
                              <div className={`flex items-center justify-center gap-1 shrink-0 ml-2 px-2 py-1 rounded ${
                                availableCount > 0 ? 'bg-success/10' : 'bg-destructive/10'
                              }`}>
                                <span className={`text-sm font-bold ${availableCount > 0 ? 'text-success' : 'text-destructive'}`}>
                                  {availableCount}
                                </span>
                                <span className={`text-xs ${availableCount > 0 ? 'text-success' : 'text-destructive'}`}>
                                  {availableCount === 1 ? 'unit' : 'units'}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {(categoryFilter === 'all' || categoryFilter === 'accessory') && accessoryProducts.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Accessories</Label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {accessoryProducts.map((prod) => (
                          <button
                            key={prod.id}
                            onClick={() => { setSelectedProduct(prod.id); setSelectedImei(null); }}
                            disabled={prod.stockQuantity === 0}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                              selectedProduct === prod.id
                                ? 'border-primary bg-primary/5'
                                : prod.stockQuantity === 0
                                  ? 'border-border bg-muted/50 opacity-50'
                                  : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium text-foreground text-sm truncate">{prod.name}</p>
                                <p className="text-xs text-muted-foreground">Ksh {prod.price.toLocaleString()}</p>
                              </div>
                            </div>
                            <span className={`text-xs font-medium shrink-0 ml-2 ${prod.stockQuantity > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                              {prod.stockQuantity}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* IMEI Selection (for phones) */}
            {isPhone && (
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-primary" />
                    Select IMEI
                    <span className="text-sm font-normal text-destructive ml-2">* Required</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by IMEI..."
                      value={imeiSearch}
                      onChange={(e) => setImeiSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {availableImeis.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {availableImeis.map((item) => {
                        const ownerRef = item.currentOwnerId || item.currentHolderId;
                        const ownerId = ownerRef?._id || ownerRef?.id || ownerRef;
                        const isAllocatedStatus = item.status === 'ALLOCATED' || item.status === 'allocated';
                        const effectiveSellerIdLocal = selectedFO || currentUser?.id;
                        const isAllocatedToSeller = isAllocatedStatus && ownerId === effectiveSellerIdLocal;

                        return (
                          <button
                            key={item.id}
                            onClick={() => setSelectedImei(item.imei)}
                            disabled={!isAllocatedToSeller && (!!selectedFO || currentUser?.role !== 'admin')}
                            title={!isAllocatedToSeller ? 'This IMEI is not allocated to the selected seller' : ''}
                            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                              selectedImei === item.imei
                                ? 'border-success bg-success/5'
                                : !isAllocatedToSeller
                                  ? 'border-border bg-muted/50 opacity-70 cursor-not-allowed'
                                  : 'border-border hover:border-success/50'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {selectedImei === item.imei ? (
                                <CheckCircle className="h-5 w-5 text-success shrink-0" />
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-muted-foreground shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="font-mono text-sm block">{item.imei}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">{isAllocatedStatus ? 'Allocated' : item.status}</span>
                                  {!isAllocatedToSeller && (
                                    <span className="text-xs text-red-600">Not allocated to seller</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="text-success font-medium text-sm shrink-0 ml-2">Ksh {(item.sellingPrice || 0).toLocaleString()}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <AlertCircle className="h-5 w-5 mr-2" />
                      {selectedProduct ? 'No IMEIs available for this phone' : 'Select a phone first'}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quantity (for accessories) */}
            {!isPhone && selectedProduct && (
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Quantity
                    <span className="text-sm font-normal text-destructive ml-2">* Required</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="h-9 w-9 p-0"
                    >
                      −
                    </Button>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center text-lg font-semibold"
                      min="1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuantity(quantity + 1)}
                      className="h-9 w-9 p-0"
                    >
                      +
                    </Button>
                    <div className="text-sm text-muted-foreground ml-auto">
                      Subtotal: Ksh {((product?.price || 0) * quantity).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment & FO Selection */}
            {selectedProduct && (isPhone ? selectedImei : true) && (
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    Payment Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Company Source Selection */}
                  <div>
                    <Label className="mb-2 block flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Selling From Company *
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['watu', 'mogo', 'onfon'] as PhoneSource[]).map((source) => (
                        <Button
                          key={source}
                          type="button"
                          variant={selectedSource === source ? 'default' : 'outline'}
                          className={`capitalize ${
                            selectedSource === source 
                              ? source === 'watu' ? 'bg-watu hover:bg-watu/90 text-white' 
                              : source === 'mogo' ? 'bg-mogo hover:bg-mogo/90 text-white'
                              : 'bg-onfon hover:bg-onfon/90 text-white'
                              : ''
                          }`}
                          onClick={() => setSelectedSource(source)}
                        >
                          {source}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* FO Selection */}
                  <div>
                    <Label className="mb-2 block flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {currentUser?.role === 'team_leader' ? 'Assign to Field Officer (Optional)' : 'Assign to Field Officer (Optional)'}
                    </Label>
                    <Select value={selectedFO || 'none'} onValueChange={(v) => setSelectedFO(v === 'none' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={currentUser?.role === 'team_leader' ? 'Leave blank for direct sale (my commission)' : 'Select FO (or leave blank)'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key="none" value="none">{currentUser?.role === 'team_leader' ? 'Direct Sale (My Commission)' : 'No FO - Direct Sale'}</SelectItem>
                        {fieldOfficers.map((fo) => (
                          <SelectItem key={fo.id} value={fo.id}>
                            {fo.foCode} - {fo.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedFO && commissionConfig && (
                      <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">{currentUser?.role === 'team_leader' ? 'Commission for FO Sale:' : 'Commission Distribution:'}</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <p className="font-semibold text-success">Ksh {commissionConfig.foCommission.toLocaleString()}</p>
                            <p className="text-muted-foreground">FO</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-primary">Ksh {commissionConfig.teamLeaderCommission.toLocaleString()}</p>
                            <p className="text-muted-foreground">{currentUser?.role === 'team_leader' ? 'Your Commission' : 'Team Leader'}</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-warning">Ksh {commissionConfig.regionalManagerCommission.toLocaleString()}</p>
                            <p className="text-muted-foreground">Regional</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div>
                    <Label className="mb-2 block">Payment Method</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant={paymentMethod === 'mpesa' ? 'default' : 'outline'}
                        className={paymentMethod === 'mpesa' ? 'bg-success hover:bg-success/90' : ''}
                        onClick={() => setPaymentMethod('mpesa')}
                      >
                        M-PESA
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                        onClick={() => setPaymentMethod('cash')}
                      >
                        Cash
                      </Button>
                    </div>
                  </div>

                  {/* Payment Reference */}
                  {paymentMethod === 'mpesa' && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">M-PESA Reference (Optional)</Label>
                      <Input
                        placeholder="e.g. SJ7K2M5P4N"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value.toUpperCase())}
                      />
                    </div>
                  )}

                  {/* Client Details */}
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Client Details
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Client Name</Label>
                        <Input
                          placeholder="e.g. Susan Andego"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Phone Number</Label>
                        <Input
                          placeholder="e.g. 0712345678"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label className="text-xs text-muted-foreground mb-1 block">ID Number</Label>
                        <Input
                          placeholder="e.g. 12345678"
                          value={clientIdNumber}
                          onChange={(e) => setClientIdNumber(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary - Sticky */}
          <div className="lg:sticky lg:top-4 h-fit">
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedProduct ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Product:</span>
                        <span className="font-medium">{product?.name}</span>
                      </div>
                      {selectedImei && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">IMEI:</span>
                          <span className="font-mono text-xs">{selectedImei}</span>
                        </div>
                      )}
                      {!isPhone && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Quantity:</span>
                          <span className="font-medium">{quantity}</span>
                        </div>
                      )}
                      {selectedFO && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Field Officer:</span>
                          <span className="font-medium">{selectedFOData?.name}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Payment:</span>
                        <span className="font-medium uppercase">{paymentMethod === 'cash' ? 'Cash' : 'M-PESA'}</span>
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-2">
                      {currentUser?.role === 'team_leader' && !selectedFO && commissionConfig?.teamLeaderCommission > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Your Commission:</span>
                          <span className="text-success">Ksh {commissionConfig.teamLeaderCommission.toLocaleString()}</span>
                        </div>
                      )}
                      {selectedFO && totalCommission > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Commission:</span>
                          <span className="text-success">Ksh {totalCommission.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold pt-2 border-t">
                        <span>Total:</span>
                        <span className="text-primary">Ksh {saleAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    <Button 
                      className="w-full h-12 text-base" 
                      disabled={!canCompleteSale() || isSaving || isLoading}
                      onClick={completeSale}
                    >
                      {isSaving ? (
                        <>
                          <ShoppingCart className="h-5 w-5 mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="h-5 w-5 mr-2" />
                          Complete Sale
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mb-3 opacity-50" />
                    <p className="text-center">Select a product to start the sale</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
