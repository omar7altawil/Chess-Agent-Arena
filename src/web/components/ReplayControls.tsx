import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight, Radio } from "lucide-react";

export function ReplayControls({
  ply,
  maxPly,
  onChange,
  onLive
}: {
  ply: number;
  maxPly: number;
  onChange: (ply: number) => void;
  onLive: () => void;
}) {
  return (
    <section className="panel replay-panel">
      <div className="replay-buttons">
        <button title="Start" onClick={() => onChange(0)}><ChevronsLeft size={17} /></button>
        <button title="Back" onClick={() => onChange(Math.max(0, ply - 1))}><ChevronLeft size={17} /></button>
        <span>{ply} / {maxPly}</span>
        <button title="Forward" onClick={() => onChange(Math.min(maxPly, ply + 1))}><ChevronRight size={17} /></button>
        <button title="End" onClick={() => onChange(maxPly)}><ChevronsRight size={17} /></button>
        <button title="Live" onClick={onLive}><Radio size={17} /></button>
      </div>
    </section>
  );
}
