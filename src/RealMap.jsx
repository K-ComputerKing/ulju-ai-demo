import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const AREAS = {
  '전체': { center: [35.488, 129.198], zoom: 11 },
  '삼남읍': { center: [35.557, 129.117], zoom: 13 },
  '온양읍': { center: [35.420, 129.281], zoom: 13 },
};

function MapMove({ region, selected }) {
  const map = useMap();
  useEffect(() => {
    const target = selected ? { center: [selected.lat, selected.lng], zoom: 15 } : AREAS[region];
    if (target) map.flyTo(target.center, target.zoom, { animate: true, duration: 0.75 });
  }, [map, region, selected]);
  return null;
}

function createMarker(parcel, active) {
  return L.divIcon({
    className: 'custom-marker-outer',
    html: `<div class="gis-marker ${parcel.riskKey}${active ? ' active' : ''}"><span class="gis-marker-core"></span></div>`,
    iconSize: [35, 43],
    iconAnchor: [17, 39],
    tooltipAnchor: [0, -34],
  });
}

export default function RealMap({ parcels, selected, region, onSelect, baseLayer, apiKey }) {
  const keyAvailable = Boolean(apiKey);
  const tileUrl = (baseLayer === 'satellite' && keyAvailable)
    ? `https://api.vworld.kr/req/wmts/1.0.0/${apiKey}/Satellite/{z}/{y}/{x}.jpeg`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution = baseLayer === 'satellite' && keyAvailable
    ? 'Map imagery © VWorld'
    : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
  const markers = useMemo(() => parcels.map(parcel => ({ parcel, icon: createMarker(parcel, selected?.id === parcel.id) })), [parcels, selected]);

  return (
    <MapContainer center={AREAS['전체'].center} zoom={11} className="gis-map" zoomControl={true} scrollWheelZoom={true} preferCanvas={true}>
      <TileLayer key={baseLayer === 'satellite' && keyAvailable ? 'satellite' : 'osm'} url={tileUrl} attribution={attribution} maxZoom={19}/>
      <MapMove region={region} selected={selected}/>
      {markers.map(({parcel,icon}) => <Marker key={parcel.id} position={[parcel.lat, parcel.lng]} icon={icon} eventHandlers={{ click: () => onSelect(parcel.id) }}><Tooltip direction="top" opacity={0.96}>{parcel.region} {parcel.name} · 가상 필지</Tooltip></Marker>)}
    </MapContainer>
  );
}
