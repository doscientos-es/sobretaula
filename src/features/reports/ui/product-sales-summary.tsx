import { Card, CardContent, CardHeader, CardTitle } from '@doscientos/ui'
export function ProductSalesSummary({ products }: { products: readonly { name: string; quantity: number; amountCents: number }[] }) {
  return <Card><CardHeader><CardTitle>Productos vendidos</CardTitle></CardHeader><CardContent><ul className="space-y-2 text-sm">{products.map((product) => <li className="flex justify-between" key={product.name}><span>{product.name} · {product.quantity} ud.</span><span>{(product.amountCents / 100).toFixed(2)} €</span></li>)}</ul></CardContent></Card>
}
