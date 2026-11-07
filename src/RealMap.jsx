import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 모두 가상 필지 중심점입니다. 실제 위험도나 불법 성토의 공간 분포가 아닙니다.
const AREAS = {
  '전체': { center: [35.488, 129.198], zoom: 11 },
  '삼남읍': { center: [35.557, 129.117], zoom: 13 },
  '온양읍': { center: [35.420, 129.281], zoom: 13 },
};

const HOTSPOT_PALETTE = {
  high: [
    [0, 'rgba(202, 26, 54, .86)'],
    [.17, 'rgba(229, 48, 58, .78)'],
    [.42, 'rgba(249, 110, 58, .54)'],
    [.72, 'rgba(255, 176, 69, .26)'],
    [1, 'rgba(255, 193, 100, 0)'],
  ],
  medium: [
    [0, 'rgba(247, 157, 26, .78)'],
    [.25, 'rgba(247, 187, 45, .64)'],
    [.65, 'rgba(250, 215, 82, .25)'],
    [1, 'rgba(247, 220, 110, 0)'],
  ],
  low: [
    [0, 'rgba(31, 157, 143, .70)'],
    [.25, 'rgba(56, 183, 148, .57)'],
    [.65, 'rgba(93, 202, 163, .23)'],
    [1, 'rgba(132, 218, 182, 0)'],
  ],
};

function MapMove({ region, selected }) {
  const map = useMap();
  useEffect(() => {
    const target = selected ? { center: [selected.lat, selected.lng], zoom: 15 } : AREAS[region];
    if (target) map.flyTo(target.center, target.zoom, { animate: true, duration: 0.75 });
  }, [map, region, selected]);
  return null;
}

/**
 * 외부 라이브러리 없이 Leaflet 지도 위에 부드러운 위험도 색상 영역을 그립니다.
 * 밀도 추정(KDE) 결과가 아닌 가상 필지별 시연용 Hotspot 시각화입니다.
 * 지도를 확대하거나 이동할 때도 지리 좌표에 붙어서 움직입니다.
 */
function HotspotCanvas({ parcels }) {
  const map = useMap();

  useEffect(() => {
    let pane = map.getPane('demoHotspotPane');
    if (!pane) {
      pane = map.createPane('demoHotspotPane');
      pane.style.zIndex = '390'; // 일반 오버레이(400) 뒤, 지도 타일(200) 위
      pane.style.pointerEvents = 'none';
    }

    const canvas = L.DomUtil.create('canvas', 'gis-hotspot-canvas', pane);
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.pointerEvents = 'none';
    let animationId = 0;

    const draw = () => {
      const size = map.getSize();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(size.x * pixelRatio));
      const height = Math.max(1, Math.round(size.y * pixelRatio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));

      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, size.x, size.y);

      const screenRadius = Math.max(58, Math.min(100, size.x * 0.077));
      const zoomFactor = Math.max(0.87, Math.min(1.15, 0.87 + (map.getZoom() - 11) * 0.08));
      const order = { low: 0, medium: 1, high: 2 };
      [...parcels].sort((a, b) => order[a.riskKey] - order[b.riskKey]).forEach((parcel) => {
        const point = map.latLngToContainerPoint([parcel.lat, parcel.lng]);
        const radius = screenRadius * zoomFactor * (parcel.riskKey === 'high' ? 1.12 : 1);
        if (point.x < -radius || point.x > size.x + radius || point.y < -radius || point.y > size.y + radius) return;
        const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
        HOTSPOT_PALETTE[parcel.riskKey].forEach(([position, color]) => gradient.addColorStop(position, color));
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fill();
      });
    };

    const scheduleDraw = () => {
      if (animationId) return;
      animationId = window.requestAnimationFrame(() => {
        animationId = 0;
        draw();
      });
    };

    map.on('move zoom resize', scheduleDraw);
    scheduleDraw();
    return () => {
      map.off('move zoom resize', scheduleDraw);
      if (animationId) window.cancelAnimationFrame(animationId);
      L.DomUtil.remove(canvas);
    };
  }, [map, parcels]);

  return null;
}

/** 클릭한 발광 영역에서 가장 가까운 가상 필지를 찾습니다. */
function HotspotInteraction({ parcels, onSelect }) {
  const map = useMap();

  useEffect(() => {
    const tooltip = L.tooltip({ direction: 'top', opacity: 0.97 });
    let hoveredId = null;
    const container = map.getContainer();
    const originalCursor = container.style.cursor;

    function findNearest(latlng) {
      const pointer = map.latLngToContainerPoint(latlng);
      let nearest = null;
      let distance = Infinity;
      parcels.forEach((parcel) => {
        const center = map.latLngToContainerPoint([parcel.lat, parcel.lng]);
        const delta = center.distanceTo(pointer);
        if (delta < distance) { nearest = parcel; distance = delta; }
      });
      return distance <= 93 ? nearest : null;
    }

    function handleClick(event) {
      const nearest = findNearest(event.latlng);
      if (nearest) onSelect(nearest.id);
    }

    function handleHover(event) {
      const nearest = findNearest(event.latlng);
      container.style.cursor = nearest ? 'pointer' : originalCursor;
      if (!nearest) {
        hoveredId = null;
        map.removeLayer(tooltip);
        return;
      }
      if (hoveredId !== nearest.id) {
        hoveredId = nearest.id;
        tooltip.setLatLng([nearest.lat, nearest.lng]);
        tooltip.setContent(`${nearest.region} ${nearest.name} · 가상 핫스팟 (클릭)`);
        tooltip.addTo(map);
      }
    }

    function clearHover() {
      hoveredId = null;
      container.style.cursor = originalCursor;
      map.removeLayer(tooltip);
    }

    map.on('click', handleClick);
    map.on('mousemove', handleHover);
    map.on('mouseout', clearHover);
    return () => {
      map.off('click', handleClick);
      map.off('mousemove', handleHover);
      map.off('mouseout', clearHover);
      clearHover();
    };
  }, [map, parcels, onSelect]);
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

export default function RealMap({ parcels, selected, region, onSelect, baseLayer, apiKey, mapMode = 'heat' }) {
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
      {mapMode === 'heat' ? <>
        <HotspotCanvas parcels={parcels}/>
        <HotspotInteraction parcels={parcels} onSelect={onSelect}/>
        {selected && <>
          <CircleMarker center={[selected.lat, selected.lng]} radius={20} pathOptions={{ color: '#ffffff', weight: 3, fillOpacity: 0, dashArray: '5 5' }} interactive={false}/>
          <CircleMarker center={[selected.lat, selected.lng]} radius={6} pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#cb3348', fillOpacity: 0.95 }} interactive={false}/>
        </>}
      </> : (
        markers.map(({parcel, icon}) => <Marker key={parcel.id} position={[parcel.lat, parcel.lng]} icon={icon} eventHandlers={{ click: () => onSelect(parcel.id) }}><Tooltip direction="top" opacity={0.96}>{parcel.region} {parcel.name} · 가상 필지</Tooltip></Marker>)
      )}
    </MapContainer>
  );
}
