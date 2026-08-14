import { Satellite } from "lucide-react";
import SatelliteVerificationPanel from "@/components/SatelliteVerificationPanel";

interface Props {
  nftId: number;
  bbox: { west: number; south: number; east: number; north: number };
  minNdviBps?: number;
  temporalExtent?: { start: string; end: string };
  sampleGridSize?: number;
}

export default function VerificationSection({ nftId, bbox, minNdviBps, temporalExtent, sampleGridSize }: Props) {
  const hasBbox = bbox.north !== 0 || bbox.south !== 0 || bbox.east !== 0 || bbox.west !== 0;

  return (
    <div className="card-farm flex-1 overflow-y-auto p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-600">
        <Satellite size={13} className="inline mr-1.5" />
        Satellite Verification
      </h3>
      {hasBbox && (
        <div className="mb-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-500">
          <div className="flex justify-between"><span>North</span><span className="font-mono">{bbox.north.toFixed(5)}</span></div>
          <div className="flex justify-between mt-0.5"><span>South</span><span className="font-mono">{bbox.south.toFixed(5)}</span></div>
          <div className="flex justify-between mt-0.5"><span>East</span><span className="font-mono">{bbox.east.toFixed(5)}</span></div>
          <div className="flex justify-between mt-0.5"><span>West</span><span className="font-mono">{bbox.west.toFixed(5)}</span></div>
        </div>
      )}
      <SatelliteVerificationPanel
        nftId={nftId}
        bbox={bbox}
        minNdviBps={minNdviBps ?? 3500}
        temporalExtent={temporalExtent}
        sampleGridSize={sampleGridSize ?? 20}
      />
    </div>
  );
}