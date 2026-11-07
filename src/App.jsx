import { useMemo, useState } from 'react';
import RealMap from './RealMap';
import RoadViewDemo from './RoadViewDemo';
import './App.css';

// 모든 좌표·분석값은 정책연구 발표를 위한 예시이며 실제 필지나 탐지 결과가 아닙니다.
// 12개 읍·면 전반에 표시하는 30개 가상 후보 중 2개만 상세 시연 대상으로 구분합니다.
const SAMPLE_PARCELS = [
  { id: 'DEMO-SN-01', region: '삼남읍', name: '대표 사례 A', lat: 35.5580, lng: 129.1170, risk: '높음', riskKey: 'high', change: 34.8, area: 420, permit: '행정자료 미연계', complaint: '모의 민원 1건', status: '미배정', featured: true, note: '식생 감소와 토양 노출이 증가했다고 가정한 시연 사례입니다. 영상 변화는 확인 대상의 후보 신호이며 성토 여부를 의미하지 않습니다.' },
  { id: 'DEMO-SN-02', region: '삼남읍', name: '가상 변화 후보 02', lat: 35.5520, lng: 129.1240, risk: '보통', riskKey: 'medium', change: 19.2, area: 275, permit: '행정자료 미연계', complaint: '없음', status: '점검 예정', note: '경작 활동이나 수확으로 인한 변화일 수 있는 가상 사례입니다.' },
  { id: 'DEMO-SN-03', region: '삼남읍', name: '가상 변화 후보 03', lat: 35.5640, lng: 129.1100, risk: '낮음', riskKey: 'low', change: 8.7, area: 98, permit: '행정자료 미연계', complaint: '없음', status: '점검 완료', note: '토양 색상 변화가 소규모로 나타났다고 가정한 가상 사례입니다.' },
  { id: 'DEMO-OY-01', region: '온양읍', name: '대표 사례 B', lat: 35.4200, lng: 129.2810, risk: '높음', riskKey: 'high', change: 41.3, area: 510, permit: '행정자료 미연계', complaint: '모의 민원 1건', status: '미배정', featured: true, note: '넓은 면적의 토지피복 변화가 나타났다고 가정한 시연 사례입니다. 위법 여부와 성토 높이는 현장조사로 확인해야 합니다.' },
  { id: 'DEMO-OY-02', region: '온양읍', name: '가상 변화 후보 05', lat: 35.4260, lng: 129.2750, risk: '보통', riskKey: 'medium', change: 22.1, area: 305, permit: '행정자료 미연계', complaint: '없음', status: '점검 예정', note: '농지 정비와 구별이 필요한 가상 사례입니다.' },
  { id: 'DEMO-OY-03', region: '온양읍', name: '가상 변화 후보 06', lat: 35.4120, lng: 129.2900, risk: '낮음', riskKey: 'low', change: 11.4, area: 140, permit: '행정자료 미연계', complaint: '없음', status: '미배정', note: '표면 색상 변화만 관찰되는 가상 사례입니다.' },
];

// 읍·면 인근에 임의로 분산한 시각화용 기준점 (필지 경계·지번·실제 위험 구역 아님).
const EXTRA_DEMO_POINTS = [
  ['범서읍', 35.573, 129.229, 'high'], ['범서읍', 35.553, 129.252, 'medium'], ['범서읍', 35.595, 129.221, 'low'],
  ['언양읍', 35.580, 129.134, 'medium'], ['언양읍', 35.569, 129.152, 'high'], ['언양읍', 35.592, 129.146, 'low'],
  ['온산읍', 35.449, 129.323, 'high'], ['온산읍', 35.430, 129.345, 'medium'], ['온산읍', 35.466, 129.311, 'low'],
  ['청량읍', 35.496, 129.280, 'medium'], ['청량읍', 35.477, 129.294, 'high'], ['청량읍', 35.513, 129.270, 'low'],
  ['웅촌면', 35.467, 129.209, 'medium'], ['웅촌면', 35.445, 129.229, 'high'],
  ['서생면', 35.355, 129.318, 'high'], ['서생면', 35.330, 129.334, 'low'],
  ['상북면', 35.606, 129.073, 'high'], ['상북면', 35.622, 129.095, 'medium'],
  ['두동면', 35.661, 129.211, 'medium'], ['두동면', 35.680, 129.191, 'low'],
  ['두서면', 35.648, 129.111, 'high'], ['두서면', 35.671, 129.084, 'medium'],
  ['삼동면', 35.521, 129.176, 'high'], ['삼동면', 35.506, 129.160, 'low'],
];

const RISK_NAMES = { high: '높음', medium: '보통', low: '낮음' };
EXTRA_DEMO_POINTS.forEach(([region, lat, lng, riskKey], index) => {
  const seq = index + 7;
  const change = Number((riskKey === 'high' ? 28 + (seq % 6) * 2.4 : riskKey === 'medium' ? 16 + (seq % 5) * 2.1 : 6 + (seq % 4) * 1.9).toFixed(1));
  SAMPLE_PARCELS.push({
    id: `DEMO-UL-${String(seq).padStart(2, '0')}`, region, name: `가상 변화 후보 ${String(seq).padStart(2, '0')}`,
    lat, lng, risk: RISK_NAMES[riskKey], riskKey, change, area: 100 + (seq * 43) % 490,
    permit: '행정자료 미연계', complaint: '모의 이력 없음', status: seq % 3 === 0 ? '점검 예정' : '미배정',
    note: '토지피복 변화가 관찰되었다고 가정한 시각화용 자료입니다. 실제 조사 결과가 아닙니다.',
  });
});

const REGIONS = ['전체', '범서읍', '언양읍', '온산읍', '온양읍', '청량읍', '삼남읍', '상북면', '서생면', '웅촌면', '두동면', '두서면', '삼동면'];
const FEATURED_IDS = ['DEMO-SN-01', 'DEMO-OY-01'];

const priorityOrder = { high: 0, medium: 1, low: 2 };

function Icon({ name, size = 18, ...props }) {
  const shapes = {
    map: <><polygon points="3,6 9,3 15,6 21,3 21,18 15,21 9,18 3,21"/><path d="M9 3v15M15 6v15"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5m-18 5 9 5 9-5"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    filter: <><path d="M4 7h16M7 12h10m-7 5h4"/><circle cx="9" cy="7" r="2" fill="white"/><circle cx="15" cy="12" r="2" fill="white"/></>,
    chart: <><path d="M4 20V10m6 10V4m6 16v-7m4 7v-4"/></>,
    check: <path d="m5 12 5 5L20 7"/>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    close: <path d="M5 5l14 14M19 5 5 19"/>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/></>,
    spark: <><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.5 5-5 2.5 2.5-5Z"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m4 18 5-5 4 3 3-4 4 6"/></>,
    clipboard: <><rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 12h6m-6 4h6"/></>,
    warning: <><path d="m10.3 3.5-8.4 15a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3l-8.4-15a2 2 0 0 0-3.4 0Z"/><path d="M12 9v5m0 3h.01"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{shapes[name] || shapes.info}</svg>;
}

function RiskPill({ parcel }) { return <span className={`risk-pill ${parcel.riskKey}`}><span className="risk-dot"/>{parcel.risk}</span>; }

function Landscape({ after = false }) {
  // 동일 구도의 가상 농지 도식. 항공영상/실제 분석 결과가 아닙니다.
  return (
    <svg className="field-illustration" viewBox="0 0 520 295" preserveAspectRatio="xMidYMid slice" role="img" aria-label={after ? '변화 후 가상 농지 도식' : '변화 전 가상 농지 도식'}>
      <rect width="520" height="295" fill="#8da58c" />
      <path d="M-20 18 170-16l52 142L30 169Z" fill="#769865"/>
      <path d="M215-30 385 5l-24 149-145-28Z" fill="#b7b78a"/>
      <path d="M385 5 547 6v150l-186-2Z" fill="#789e78"/>
      <path d="M-20 187 182 155l34 165-240 5Z" fill="#bbc69a"/>
      <path d="M218 153 359 172l-21 146-122-2Z" fill={after ? '#b78b5c' : '#78a075'}/>
      <path d="M357 175 530 168v160H337Z" fill="#9eaa7c"/>
      <path d="M0 178 550 150" stroke="#d5cfc1" strokeWidth="23" opacity=".9" />
      <path d="M197-25 216 310" stroke="#d6cfbe" strokeWidth="16" />
      <path d="M370-30 340 320" stroke="#f1e9d4" strokeWidth="8"/>
      <g stroke="#d8ddb4" strokeWidth="2" opacity=".6">
        <path d="M15 35l181-31M10 55l189-28M5 76l198-27M0 97l203-27M0 118l205-25M0 139l204-25"/>
        <path d="M230 5l140 27M228 21l140 27M226 38l140 27M225 56l140 27M224 72l139 27M222 88l139 27"/>
        <path d="M382 28h148M382 43h148M382 58h148M382 73h148M382 88h148M382 103h148"/>
      </g>
      {after ? (
        <g>
          <path d="m232 191 100 8-14 91-82-2Z" fill="#bd9265" stroke="#96734e" strokeWidth="3" />
          <path d="M240 220 311 228M241 242l67 8M240 264l65 3" stroke="#d7ad7c" strokeWidth="6" opacity=".75" />
          <path d="M259 206 298 208" stroke="#dfc4a0" strokeWidth="10" opacity=".8"/>
        </g>
      ) : (
        <g stroke="#b9cba0" strokeWidth="3" opacity=".8">
          <path d="M240 186l-12 99M256 185l-10 103M274 189l-10 98M291 190l-8 96M310 194l-6 93"/>
        </g>
      )}
      <g fill="none" stroke="#f9f7ed" strokeWidth="3" opacity=".85"><path d="M214 153 359 172l-21 146-122-2Z"/></g>
    </svg>
  );
}

function CompareField({ parcel }) {
  const [position, setPosition] = useState(49);
  const [showMask, setShowMask] = useState(false);
  return (
    <div className="compare-widget">
      <div className="compare-title-row"><strong>전·후 영상 비교 시연</strong><span className="soft-tag">가상 영상 도식</span></div>
      <div className="compare-frame">
        <div className="compare-base"><Landscape after={false}/></div>
        <div className="compare-after" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}><Landscape after={true}/></div>
        {showMask && <div className="compare-mask" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}><svg viewBox="0 0 520 295" preserveAspectRatio="xMidYMid slice"><path d="m232 191 100 8-14 91-82-2Z" fill="#fb3b44" fillOpacity=".35" stroke="#f12f3c" strokeWidth="5" strokeDasharray="8 5"/></svg></div>}
        <div className="compare-divider" style={{ left: `${position}%` }}><span>↔</span></div>
        <span className="compare-label before">변화 전</span><span className="compare-label after">변화 후</span>
        <input className="compare-range" type="range" min="0" max="100" value={position} onChange={e => setPosition(Number(e.target.value))} aria-label="전후 영상 비교 슬라이더" />
      </div>
      <div className="compare-actions"><span>슬라이더를 움직여 비교해 보세요</span><label className="check-control"><input type="checkbox" checked={showMask} onChange={e => setShowMask(e.target.checked)}/> 변화영역 표시</label></div>
      <p className="sample-description">{parcel.name}의 예시 화면입니다. 실제 스카이뷰 원본이나 AI 탐지 결과가 아닙니다.</p>
    </div>
  );
}

function ParcelDetail({ parcel, onClose, onStatusUpdate, status, onOpenGuide }) {
  const [tab, setTab] = useState('road');
  const [reportOpen, setReportOpen] = useState(false);
  return (
    <aside className="detail-drawer" aria-label="가상 필지 상세정보">
      <div className="drawer-heading"><div><span className="drawer-eyebrow">★ 대표 상세 시연 · 가상 사례</span><h2>{parcel.region} {parcel.name}</h2><span className="parcel-code">{parcel.id}</span></div><button className="icon-button" onClick={onClose} aria-label="상세정보 닫기"><Icon name="close" size={20}/></button></div>
      <div className="drawer-scroll">
        <div className="drawer-status"><RiskPill parcel={parcel}/><span className="status-chip">{status}</span><span className="data-note">촬영영상 아님 · 모의 수치</span></div>
        <div className="detail-stats"><div><span>토지피복 변화율</span><strong>{parcel.change}%</strong></div><div><span>변화 추정면적</span><strong>{parcel.area}<small>㎡</small></strong></div></div>
        <div className="tab-group feature-tabs" role="tablist" aria-label="대표 상세 시연 화면">
          <button role="tab" aria-selected={tab === 'road'} className={tab === 'road' ? 'selected' : ''} onClick={() => setTab('road')}><Icon name="compass" size={15}/> 현장뷰</button>
          <button role="tab" aria-selected={tab === 'compare'} className={tab === 'compare' ? 'selected' : ''} onClick={() => setTab('compare')}><Icon name="image" size={15}/> 영상 비교</button>
          <button role="tab" aria-selected={tab === 'analysis'} className={tab === 'analysis' ? 'selected' : ''} onClick={() => setTab('analysis')}><Icon name="spark" size={15}/> AI 요약</button>
          <button role="tab" aria-selected={tab === 'checklist'} className={tab === 'checklist' ? 'selected' : ''} onClick={() => setTab('checklist')}><Icon name="clipboard" size={15}/> 점검관리</button>
        </div>
        {tab === 'road' && <RoadViewDemo parcel={parcel} onNext={() => setTab('compare')}/>}
        {tab === 'compare' && <><CompareField key={parcel.id} parcel={parcel}/><div className="detail-data"><div><span>신고·허가 정보</span><b>{parcel.permit}</b></div><div><span>민원 이력</span><b>{parcel.complaint}</b></div></div><button className="action-primary" onClick={() => setTab('analysis')}><Icon name="spark" size={17}/> 모의 AI 분석 결과 보기 <Icon name="arrow" size={17}/></button></>}
        {tab === 'analysis' && <div className="content-panel"><div className="content-head"><Icon name="spark" size={18}/><b>사전 작성된 AI 요약 예시</b></div><p>{parcel.note}</p><ul><li>전·후영상 촬영 시점 및 동일 위치 여부 검토</li><li>신고·허가 이력과 현장 상황 대조</li><li>수확·경작·계절 변화에 따른 오탐 가능성 확인</li></ul><div className="inline-notice"><Icon name="info" size={16}/> 실제 생성형 AI를 호출하지 않은 시연 응답입니다.</div><button className="action-primary" onClick={() => {setTab('checklist');setReportOpen(true);}}><Icon name="file" size={17}/> 점검보고서 초안 보기 <Icon name="arrow" size={17}/></button></div>}
        {tab === 'checklist' && <div className="content-panel"><div className="content-head"><Icon name="clipboard" size={18}/><b>현장 확인 체크리스트</b></div><ul className="checklist"><li>영상의 촬영일과 위치 정합 여부 확인</li><li>농지개량 신고·허가 이력 조회</li><li>수확·경작 등 정상적 변화 여부 확인</li><li>필요 시 현장 방문 및 높이 측량</li></ul><div className="status-row"><span>점검 상태</span><strong>{status}</strong></div><button className="action-secondary" onClick={onStatusUpdate}><Icon name="check" size={17}/> 시연용 상태 변경</button><button className="action-primary" onClick={() => setReportOpen(v => !v)}><Icon name="file" size={17}/> {reportOpen ? '보고서 초안 닫기' : '보고서 초안 생성'} <Icon name="arrow" size={17}/></button>{reportOpen && <div className="report-draft"><span>AI 보고서 초안 · 사전 작성된 예시</span><strong>농지 변화 의심지역 현장점검 검토서</strong><p>대상: {parcel.region} {parcel.name} ({parcel.id})</p><p>관측: 토지피복 변화율 {parcel.change}%, 변화면적 추정 {parcel.area}㎡(모의 수치)</p><p>검토: 위성·항공영상 비교에서 변화가 표시되었으나 성토 및 위법 여부는 미확정.</p><p>권장: 허가·신고자료 대조 후 필요 시 현장 확인.</p><small>초안은 반드시 담당 공무원이 검토해야 합니다.</small></div>}</div>}
        <div className="drawer-footer"><Icon name="warning" size={17}/><p><strong>주의:</strong> 2D 영상만으로 성토 높이·토사 성분·위법 여부는 확정할 수 없습니다. 최종 확인은 공무원이 수행합니다.</p></div>
        <button className="text-link" onClick={onOpenGuide}><Icon name="help" size={15}/> 시연용 기능과 실제 연계의 차이 보기</button>
      </div>
    </aside>
  );
}

function SpotSummary({ parcel, onClose, onShowcase }) {
  return (
    <aside className="detail-drawer summary-drawer" aria-label="일반 가상 핫스팟 요약">
      <div className="drawer-heading"><div><span className="drawer-eyebrow">일반 가상 핫스팟 · 기본 정보</span><h2>{parcel.region} {parcel.name}</h2><span className="parcel-code">{parcel.id}</span></div><button className="icon-button" onClick={onClose} aria-label="요약 닫기"><Icon name="close" size={20}/></button></div>
      <div className="drawer-scroll">
        <div className="drawer-status"><RiskPill parcel={parcel}/><span className="status-chip">전역 현황용</span><span className="data-note">실제 탐지 결과 아님</span></div>
        <div className="summary-banner"><Icon name="map" size={21}/><div><strong>가상 후보지 간단 조회</strong><p>지도 분포를 보여주기 위한 시연 데이터입니다. 이 지역에는 현장뷰·영상 비교·AI 보고서 기능을 구현하지 않았습니다.</p></div></div>
        <div className="detail-stats"><div><span>가정한 토지피복 변화율</span><strong>{parcel.change}%</strong></div><div><span>가정한 변화면적</span><strong>{parcel.area}<small>㎡</small></strong></div></div>
        <div className="content-panel"><div className="content-head"><Icon name="info" size={18}/><b>모의 조회 결과</b></div><p>{parcel.note}</p><p>인허가·민원 시스템 및 실제 영상 데이터와 연계되어 있지 않으며, 지도의 점 위치는 지번을 가리키지 않습니다.</p></div>
        <div className="summary-next"><span>대표 상세 시연 보기</span><p>아래 두 사례에서 로드뷰형 현장 시점, 전후 비교, AI 요약과 보고서 초안을 체험할 수 있습니다.</p>
          <div className="summary-quick-actions"><button onClick={() => onShowcase('DEMO-SN-01')}>삼남읍 대표 A →</button><button onClick={() => onShowcase('DEMO-OY-01')}>온양읍 대표 B →</button></div>
        </div>
        <div className="drawer-footer"><Icon name="warning" size={17}/><p>핫스팟 분포 및 수치는 예시이며, 불법 성토 여부는 판정할 수 없습니다.</p></div>
      </div>
    </aside>
  );
}

export default function App() {
  const [region, setRegion] = useState('전체');
  const [risk, setRisk] = useState('전체');
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [baseLayer, setBaseLayer] = useState('street');
  const [mapMode, setMapMode] = useState('cluster');
  const [showGuide, setShowGuide] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [statusOverrides, setStatusOverrides] = useState({});
  const [message, setMessage] = useState('');
  const key = import.meta.env.VITE_VWORLD_API_KEY;

  const visibleParcels = useMemo(() => SAMPLE_PARCELS.filter(p =>
    (region === '전체' || p.region === region) &&
    (risk === '전체' || p.risk === risk) &&
    (`${p.id} ${p.region} ${p.name}`.toLowerCase().includes(keyword.trim().toLowerCase()))
  ).sort((a,b) => priorityOrder[a.riskKey] - priorityOrder[b.riskKey]), [region,risk,keyword]);

  const selected = visibleParcels.find(p => p.id === selectedId) || null;
  const highCount = visibleParcels.filter(p => p.riskKey === 'high').length;
  const unassigned = visibleParcels.filter(p => (statusOverrides[p.id] || p.status) === '미배정').length;

  function handleSelectRegion(value) { setRegion(value); setSelectedId(null); }
  function handleSelectRisk(value) { setRisk(value); setSelectedId(null); }
  function handleSelectParcel(id) { setSelectedId(id); setShowPanel(true); }
  function handleShowcase(id) { setRegion('전체'); setRisk('전체'); setKeyword(''); setSelectedId(id); setShowPanel(true); }
  function handleChangeStatus() {
    if (!selected) return;
    const current = statusOverrides[selected.id] || selected.status;
    const next = current === '미배정' ? '점검 예정' : current === '점검 예정' ? '점검 완료' : '미배정';
    setStatusOverrides(v => ({ ...v, [selected.id]: next }));
    setMessage(`${selected.name}: ${next} (시연용 임시 변경)`);
  }
  function handleLayer(next) {
    if (next === 'satellite' && !key) { setMessage('항공영상 전환은 VWorld API 키 설정 후 사용할 수 있습니다. 현재 기본지도는 정상 작동합니다.'); return; }
    setBaseLayer(next); setMessage('');
  }

  return (
    <div className="fullscreen-app">
      <div className="map-background"><RealMap parcels={visibleParcels} selected={selected} region={region} onSelect={handleSelectParcel} baseLayer={baseLayer} apiKey={key} mapMode={mapMode} /></div>

      <header className="app-header">
        <div className="product-brand"><span className="brand-logo"><Icon name="map" size={25}/></span><div><strong>울주 AI 불법성토 모니터링</strong><small>프로일잘러의 업무 혁신 정책 연구단</small></div></div>
        <nav className="header-actions" aria-label="서비스 메뉴"><span className="demo-mark">DEMO · 가상 데이터</span><button className="header-help" onClick={() => setShowGuide(true)}><Icon name="help" size={17}/> 시연 안내</button></nav>
      </header>

      <div className="floating-toolbar" aria-label="지도 선택"><button className={baseLayer==='street' ? 'active' : ''} onClick={() => handleLayer('street')}><Icon name="map" size={16}/> 일반지도</button><button className={baseLayer==='satellite' ? 'active' : ''} onClick={() => handleLayer('satellite')} title={key ? 'VWorld 항공영상 전환' : 'VWorld API 키가 필요한 기능'}><Icon name="layers" size={16}/> 항공영상{!key && <span className="lock-hint">키 필요</span>}</button><span className="toolbar-separator"/><button className={mapMode==='cluster' ? 'active cluster-active' : ''} onClick={() => setMapMode('cluster')}><Icon name="layers" size={16}/> 원형 클러스터</button><button className={mapMode==='pins' ? 'active' : ''} onClick={() => setMapMode('pins')}><Icon name="pin" size={16}/> 필지 핀</button></div>

      {!showPanel && <button className="panel-restore" onClick={() => setShowPanel(true)} aria-label="필지 목록 열기"><Icon name="search" size={18}/> 필지 목록 열기</button>}
      {showPanel && <aside className="left-panel">
        <div className="panel-top"><div><span className="panel-kicker">실시간 지도가 아닌 시연용 분석</span><h1>울주군 전역 모니터링</h1><p>30개 분산 후보 · 대표 2곳에서 상세 시연</p></div><button className="icon-button panel-hide" onClick={() => setShowPanel(false)} title="목록 숨기기"><Icon name="close" size={18}/></button></div>
        <div className="stat-strip"><div><span>표시 후보</span><strong>{visibleParcels.length}<small>건</small></strong></div><div><span>높은 우선순위</span><strong>{highCount}<small>건</small></strong></div><div><span>미배정</span><strong>{unassigned}<small>건</small></strong></div></div>
        <div className="panel-content">
          <label className="search-field"><Icon name="search" size={18}/><input placeholder="필지명 또는 시연 ID 검색" value={keyword} onChange={e => {setKeyword(e.target.value);setSelectedId(null);}} aria-label="필지 검색" /></label>
          <div className="filter-caption"><Icon name="pin" size={15}/> 지역 선택</div>
          <div className="segmented-control">{['전체','삼남읍','온양읍'].map(r => <button key={r} className={region===r ? 'active' : ''} onClick={() => handleSelectRegion(r)}>{r}</button>)}</div>
          <select className="all-region-select" value={region} onChange={e => handleSelectRegion(e.target.value)} aria-label="울주군 12개 읍면 중 지역 선택">
            {REGIONS.map(r => <option key={r} value={r}>{r === '전체' ? '울주군 전역 (전체)' : r}</option>)}
          </select>
          <div className="filter-caption"><Icon name="filter" size={15}/> 우선순위</div>
          <div className="risk-filter">{['전체','높음','보통','낮음'].map(item => <button key={item} className={risk===item ? 'active' : ''} onClick={() => handleSelectRisk(item)}>{item}</button>)}</div>
          <div className="showcase-card"><div className="showcase-heading"><Icon name="spark" size={16}/><strong>대표 상세 시연 2곳</strong><span>ROADVIEW DEMO</span></div><p>전역 핫스팟은 30곳, 정교한 상세 기능은 아래 두 곳에서만 시연합니다.</p><div className="showcase-choices">{FEATURED_IDS.map(id => { const p = SAMPLE_PARCELS.find(item => item.id === id); return <button key={id} onClick={() => handleShowcase(id)} className={selectedId === id ? 'chosen' : ''}><span>{p.region}</span><strong>{p.name}</strong><small>현장뷰 · AI · 보고서 →</small></button>; })}</div></div>
          <div className="list-title"><strong>전체 변화 후보</strong><span>{visibleParcels.length}건 · 가상 사례</span></div>
          <div className="parcel-list">{visibleParcels.map(parcel => <button key={parcel.id} className={`parcel-item ${selectedId === parcel.id ? 'selected' : ''}`} onClick={() => handleSelectParcel(parcel.id)}><span className={`parcel-marker-dot ${parcel.riskKey}`}/><span className="parcel-item-main"><strong>{parcel.region} {parcel.name} {parcel.featured && <span className="featured-mini">상세 시연</span>}</strong><small>{parcel.id} · {parcel.featured ? '전체 기능' : '기본 요약'} · {statusOverrides[parcel.id] || parcel.status}</small></span><span className="parcel-item-side"><RiskPill parcel={parcel}/><small>변화 {parcel.change}%</small></span></button>)}{visibleParcels.length===0 && <div className="no-result">조건에 해당하는 가상 필지가 없습니다.</div>}</div>
        </div>
        <div className="left-panel-foot"><Icon name="info" size={16}/><span>전역 30개 가상 좌표의 분포입니다. 상세 시연은 대표 2곳만 제공됩니다.</span></div>
      </aside>}

      {!selected && <div className="welcome-float"><span className="welcome-icon"><Icon name="compass" size={20}/></span><div><strong>{mapMode === 'cluster' ? '원 안의 숫자를 눌러 확대해 보세요' : '지도에서 가상 후보를 선택해 보세요'}</strong><small>30개 가상 후보 중 대표 2곳만 상세 시연을 제공합니다.</small></div></div>}
      {selected && (selected.featured
        ? <ParcelDetail key={selected.id} parcel={selected} status={statusOverrides[selected.id] || selected.status} onStatusUpdate={handleChangeStatus} onClose={() => setSelectedId(null)} onOpenGuide={() => setShowGuide(true)}/>
        : <SpotSummary key={selected.id} parcel={selected} onClose={() => setSelectedId(null)} onShowcase={handleShowcase}/>
      )}
      {mapMode === 'cluster' && !selected && <div className="cluster-legend" aria-label="원형 클러스터 사용 안내"><strong>원형 클러스터 지도 <small>DEMO</small></strong><div className="cluster-legend-rings"><span className="cluster-legend-ring red">고우선</span><span className="cluster-legend-ring pink">보통</span><span className="cluster-legend-ring blue">낮음</span></div><p><b>숫자 = 묶인 가상 후보 개수</b><br/>클릭해 확대하면 후보가 개별 표시됩니다.<br/>★ 표시에는 대표 상세 사례가 포함됩니다.</p></div>}
      
      <div className="map-disclaimer"><Icon name="info" size={15}/> 시연 화면 · 원 안의 수는 가상 후보 개수 · 2D 영상만으로 위법 여부 판단 불가 · 스카이뷰 미연계</div>
      {message && <div className="toast"><Icon name="info" size={16}/>{message}<button onClick={() => setMessage('')} aria-label="알림 닫기">×</button></div>}

      {showGuide && <div className="dialog-overlay" onClick={() => setShowGuide(false)}><div className="guide-dialog" role="dialog" aria-modal="true" aria-label="발표용 시연 안내" onClick={e => e.stopPropagation()}><button className="icon-button guide-x" onClick={() => setShowGuide(false)} aria-label="닫기"><Icon name="close" size={19}/></button><span className="guide-eyebrow">2026 정책연구단 · 프로일잘러의 업무혁신</span><h2>3분 시연 순서</h2><ol><li><b>울주군 전체 지도</b>에서 12개 읍·면에 분포한 가상 원형 클러스터와 30개 후보 확인</li><li>일반 핫스팟을 눌러 <b>기본 요약</b>만 열리는 모습 시연</li><li>왼쪽 <b>대표 상세 시연</b>에서 삼남읍 또는 온양읍 선택</li><li><b>현장뷰</b> 좌우 이동 → <b>전후영상 슬라이더</b> 비교</li><li><b>모의 AI 요약</b> → 점검 체크리스트 → 보고서 초안</li></ol><div className="guide-warning"><Icon name="warning" size={18}/><span>실제 영상·허가·민원 DB, AI 모델, 울주 스카이맵·스카이뷰는 연결되지 않았습니다. 필지 위치 및 분석값은 모두 가상입니다.</span></div><button className="action-primary" onClick={() => setShowGuide(false)}>시연 시작하기 <Icon name="arrow" size={17}/></button></div></div>}
    </div>
  );
}
