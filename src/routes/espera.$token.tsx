import { createFileRoute } from '@tanstack/react-router'
import { getWaitlistOffer, PublicWaitlistOfferPage } from '@/features/public-waitlist'
export const Route = createFileRoute('/espera/$token')({ loader: ({ params }) => getWaitlistOffer({ data: { token: params.token } }), component: OfferRoute })
function OfferRoute() { return <PublicWaitlistOfferPage offer={Route.useLoaderData()} token={Route.useParams().token} /> }
