import ListingsMapClient from '@/components/map/ListingsMapClient';

export const metadata = {
  title: 'Listings Map',
};

export default function MapPage() {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    console.error("Mapbox token is not configured. Please set NEXT_PUBLIC_MAPBOX_TOKEN environment variable.");
    return (
      <div className="p-4 text-red-500 bg-red-900/20 rounded-md">
        Map cannot be displayed: Mapbox token is missing. 
        Please contact an administrator or check server configuration.
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-sky-400">Real Estate Listings Map</h1>
      <ListingsMapClient mapboxToken={mapboxToken} />
    </div>
  );
} 