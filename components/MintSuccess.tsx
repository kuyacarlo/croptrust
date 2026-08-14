import { CheckCircle, Rocket } from "lucide-react";

interface Props {
  mintTxHash: string | null;
  mintedNftId: number | null;
  onListAnother: () => void;
}

export default function MintSuccess({ mintTxHash, mintedNftId, onListAnother }: Props) {
  return (
    <div className="card-farm p-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-farm-100 text-farm-600">
        <CheckCircle size={30} />
      </div>
      <h3 className="mt-3 text-base font-bold text-stone-800">Crop Listed!</h3>
      <p className="mt-1 text-sm text-stone-500">
        Your crop is now listed on-chain.
      </p>
      {mintTxHash && (
        <p className="mt-2 font-mono text-[10px] text-stone-400 break-all">
          tx: {mintTxHash.slice(0, 30)}...
        </p>
      )}
      {mintedNftId && (
        <p className="mt-1 text-xs font-medium text-farm-700">
          NFT #{mintedNftId} minted
        </p>
      )}
      <button onClick={onListAnother} className="btn-primary mt-4 w-full justify-center">
        <Rocket size={16} /> List Another Parcel
      </button>
    </div>
  );
}