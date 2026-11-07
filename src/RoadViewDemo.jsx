import { useRef, useState } from 'react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * 로드뷰 UX를 흉내 낸 로컬 SVG 파노라마 뷰어.
 * 실제 도로 영상, CCTV, 카카오/네이버/구글 거리뷰 API를 사용하지 않습니다.
 */
export default function RoadViewDemo({ parcel, onNext }) {
  const [pan, setPan] = useState(28);
  const [showHint, setShowHint] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const dragging = useRef(null);
  const isSamnam = parcel.id === 'DEMO-SN-01';
  const src = isSamnam ? '/demo-roadview-samnam.svg' : '/demo-roadview-onyang.svg';
  const bearing = Math.round((pan / 58) * 210 + (isSamnam ? 30 : 100)) % 360;

  function pointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    dragging.current = { x: event.clientX, start: pan };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    if (!dragging.current) return;
    const width = event.currentTarget.clientWidth || 400;
    setPan(clamp(dragging.current.start - ((event.clientX - dragging.current.x) / width) * 24, 0, 58));
  }
  function pointerUp() { dragging.current = null; }

  return (
    <section className="roadview-wrap" aria-label="시연용 로드뷰형 현장 시점">
      <div className="compare-title-row"><strong>로드뷰형 현장 시점 시연</strong><span className="soft-tag">가상 파노라마</span></div>
      <div className="roadview-viewport" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} role="group" aria-label="마우스나 손가락으로 좌우 드래그하여 가상 농지 풍경 이동">
        <img src={src} alt="실제 촬영 사진이 아닌 가상의 농지 현장 파노라마" className="roadview-panorama" style={{ transform: `translateX(-${pan}%)` }} draggable="false" />
        <div className="roadview-topbar"><span className="roadview-live"><span/> 현장 시점 · SIMULATION</span><span className="roadview-compass">◈ {bearing}°</span></div>
        {highlight && <div className="roadview-target" aria-hidden="true"><span>토지피복 변화 가정 구역</span></div>}
        {showHint && <div className="roadview-hint" onClick={event => event.stopPropagation()}>↔ 드래그하여 시점을 움직여 보세요 <button onClick={() => setShowHint(false)} aria-label="도움말 숨기기">×</button></div>}
        <div className="roadview-watermark">DEMO / 가상 현장 이미지 · 실제 로드뷰 아님</div>
      </div>
      <div className="roadview-nav">
        <button onClick={() => setPan(value => clamp(value - 12, 0, 58))} aria-label="왼쪽 시점 이동">◀</button>
        <div className="roadview-nav-center"><strong>{parcel.region} · 시점 {isSamnam ? 'A' : 'B'}</strong><span>사진·촬영 일시·현장 위치 모두 가상</span></div>
        <button onClick={() => setPan(value => clamp(value + 12, 0, 58))} aria-label="오른쪽 시점 이동">▶</button>
      </div>
      <label className="roadview-highlight"><input type="checkbox" checked={highlight} onChange={event => setHighlight(event.target.checked)} /> 가상 변화 관찰 구역 강조</label>
      <div className="inline-notice roadview-notice">이 화면은 로드뷰와 비슷한 탐색 방식을 보여주는 <b>시뮬레이션</b>입니다. 실물 사진·3D 측량·실제 위치 연동이 아닙니다.</div>
      <button className="action-primary" onClick={onNext}>다음 단계 · 전후영상 비교 <span style={{marginLeft:'auto'}}>→</span></button>
    </section>
  );
}
