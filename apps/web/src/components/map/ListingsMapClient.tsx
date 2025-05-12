'use client';

import { useEffect, useState, useRef } from 'react';
import mapboxgl, { Map } from 'mapbox-gl';
import supercluster from 'supercluster';
import { Modal } from '../ui/Modal';
import { Carousel } from 'react-responsive-carousel';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'react-responsive-carousel/lib/styles/carousel.min.css';

// Updated placeholder types to better match observed API response
interface ListingJsonData {
  address?: string; // Changed from object to string, made optional
  listPrice?: number; // Keep as optional, may not be in all records
  bedrooms?: number;
  bathrooms?: number;
  latitude?: number;
  longitude?: number;
  /** Medium-sized main photo for popup */
  property_image?: string;
}
interface ScoreData {
  alignmentScore: number;
}
interface Listing {
  extId: string;
  url: string;
  jsonData: ListingJsonData;
  scoreData?: ScoreData;
}
interface ApiListingsResponse {
  listings: Listing[];
}

// API base URL (falls back to local Fastify port 3001)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

// Placeholder for API fetch function
async function fetchMapListingsAPI(params: URLSearchParams): Promise<ApiListingsResponse> {
  // For map, you might want to fetch listings within a viewport (bbox) or all SF listings
  // For now, let's assume it fetches a general set for SF, similar to dashboard but maybe more
  // Or a version of /api/listings that returns ALL listings matching basic criteria for map display.
  // The current /api/listings is paginated. We might need a different variant or fetch all pages.
  // For simplicity, let's use a high limit for now.
  params.set('limit', '100');
  const response = await fetch(`${API_BASE_URL}/listings?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch listings for map' }));
    throw new Error(errorData.message || 'Failed to fetch listings for map');
  }
  return response.json();
}

interface ListingsMapClientProps {
  mapboxToken: string;
}

export default function ListingsMapClient({ mapboxToken }: ListingsMapClientProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popupListing, setPopupListing] = useState<Listing | null>(null);

  mapboxgl.accessToken = mapboxToken;
  // @ts-ignore - older type defs for mapboxgl missing some APIs
  mapboxgl.config.REQUEST_TIMEOUT_MS = 0; // Disable mapbox telemetry

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return; // Initialize map only once

    // Block telemetry before map loads
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(this: XMLHttpRequest, ...args) {
      // Access internal url property that Mapbox sets
      const url = (this as any)._url || (this as any).url || '';
      if (url.includes('events.mapbox.com')) {
        // Drop the request silently
        console.log('Blocked mapbox telemetry call to', url);
        return;
      }
      return originalSend.apply(this, args);
    };

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', // Free style that doesn't need token validation
      center: [-122.431297, 37.773972], // Default center: San Francisco
      zoom: 11,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    mapRef.current.resize(); // ADDED: Force resize after initial setup

    // Clean up map instance on unmount
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  // Fetch listings data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams(); // Add any default filters if needed for map
      try {
        const result = await fetchMapListingsAPI(params);
        console.log('Fetched listings:', result.listings);
        setListings(result.listings);
        if (mapRef.current) {
          requestAnimationFrame(() => { 
            mapRef.current?.resize(); // Ensure mapRef.current is checked for null inside as well
          });
        }
      } catch (e: any) {
        setError(e.message || 'An unexpected error occurred while fetching map data.');
      }
      setIsLoading(false);
    };
    fetchData();
  }, []); // Fetch once on mount for now

  // Clustering layer setup
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current!;

    let moveHandler: (() => void) | undefined;

    const initClusters = () => {
      // Build GeoJSON feature list
      const features = listings
        .filter(l => l.jsonData.latitude && l.jsonData.longitude)
        .map(l => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [l.jsonData.longitude!, l.jsonData.latitude!] },
          properties: { extId: l.extId },
        }));
      console.log('Features for clustering:', features); // DEBUGGING

      const clusterIdx = new supercluster({ radius: 60, maxZoom: 16 }).load(features as any);

      function updateClusters() {
        // More robust check for map and source
        if (!map || !map.getSource('listings')) { 
          console.warn("Map or map source 'listings' not found in updateClusters. Skipping update.", { mapExists: !!map, sourceExists: !!map?.getSource('listings') });
          return;
        }
        console.log("updateClusters called. Map and source 'listings' should exist."); // DEBUGGING

        const bbox = map.getBounds().toArray().flat();
        const zoom = map.getZoom();
        const clusters = clusterIdx.getClusters(bbox as [number, number, number, number], Math.round(zoom));
        
        try {
          (map.getSource('listings') as any).setData({ type: 'FeatureCollection', features: clusters });
          console.log("Updated map data with clusters:", clusters); // DEBUGGING
        } catch (error) {
          console.error("Error in setData on 'listings' source:", error); // DEBUGGING
        }
      }

      moveHandler = updateClusters;
      map.on('move', moveHandler);

      if (!map.getSource('listings')) {
        map.addSource('listings', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: false,
        });

        map.addLayer({
          id: 'cluster',
          type: 'circle',
          source: 'listings',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#3b82f6',
            'circle-radius': 12,
          },
        });

        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'listings',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 12,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });

        map.addLayer({
          id: 'listing-point',
          type: 'circle',
          source: 'listings',
          paint: {
            'circle-color': '#facc15',
            'circle-radius': 10,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          },
        });

        map.on('click', 'listing-point', (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const extId = feature.properties?.extId;
          const listing = listings.find(l => l.extId === extId);
          if (listing) setPopupListing(listing);
        });

        // Create a popup for hover, but don't add it to the map yet.
        const hoverPopup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          anchor: 'bottom' // Anchor popup above the point
        });

        map.on('mouseenter', 'listing-point', (e) => {
          if (!e.features || e.features.length === 0) return;
          const feature = e.features[0];

          if (!feature || 
              !feature.geometry || feature.geometry.type !== 'Point' || !feature.geometry.coordinates ||
              !feature.properties || typeof feature.properties.extId === 'undefined') {
            return;
          }
          
          map.getCanvas().style.cursor = 'pointer';

          const listing = listings.find(l => l.extId === feature.properties!.extId); // extId is checked above
          if (!listing || !listing.jsonData) return;

          // Make sure coordinates and lngLat are valid numbers before using them
          const coordinates = feature.geometry.coordinates.slice() as [number, number];
          const lngLat = e.lngLat;

          if (typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number' || 
              !lngLat || typeof lngLat.lng !== 'number' || typeof lngLat.lat !== 'number') {
            console.warn('Invalid coordinates or lngLat for hover popup');
            return;
          }
          
          const popupHtml = `<div><strong>${listing.jsonData.address || 'Address N/A'}</strong></div>`;

          // Adjust coordinates to prevent popup from jumping across dateline
          // This loop might not be strictly necessary if data is always in a similar longitude range
          // but it's a good safeguard.
          let currentLng = coordinates[0];
          while (Math.abs(lngLat.lng - currentLng) > 180) {
            currentLng += lngLat.lng > currentLng ? 360 : -360;
          }

          hoverPopup
            .setLngLat([currentLng, coordinates[1]])
            .setHTML(popupHtml)
            .addTo(map);
        });

        map.on('mouseleave', 'listing-point', () => {
          map.getCanvas().style.cursor = '';
          hoverPopup.remove();
        });

      }

      updateClusters();
    };

    if (map.isStyleLoaded()) {
      initClusters();
    } else {
      map.once('load', initClusters);
    }

    // Cleanup: remove event listeners added in initClusters when listings change/unmount
    return () => {
      if (map) {
        map.off('load', initClusters as any);
        if (moveHandler) map.off('move', moveHandler);
      }
    };
  }, [listings]);

  if (error) {
    return <div className="text-red-500 p-4 bg-red-900/20 rounded-md">Error loading map data: {error}</div>;
  }

  return (
    <div className="relative h-[calc(100vh-200px)]"> {/* Adjust height as needed */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-800/70 z-10">
          <p className="text-lg text-neutral-200">Loading map and listings...</p>
          {/* Spinner or more advanced loader can go here */}
        </div>
      )}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
      {popupListing && (
        <Modal open={true} onClose={() => setPopupListing(null)} title={popupListing.jsonData.address}>
          <Carousel showThumbs={false} infiniteLoop>
            {popupListing.jsonData.property_image ? [
              <div key="img">
                <img src={popupListing.jsonData.property_image} alt="listing" />
              </div>,
            ] : []}
          </Carousel>
          <p className="mt-2 text-sm text-neutral-300">Price: {popupListing.jsonData.listPrice ? `$${popupListing.jsonData.listPrice.toLocaleString()}` : 'N/A'}</p>
          <a href={popupListing.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline text-sm">View on Zillow</a>
        </Modal>
      )}
    </div>
  );
} 