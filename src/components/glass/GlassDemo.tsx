import { motion } from 'framer-motion';
import { ArrowLeftRight, House, Plus, Upload, X } from 'lucide-react';
import { GlassBar, GlassButton } from './LiquidGlass';

/**
 * Liquid Glass lab — one polished demo screen. Vivid warm backdrop so the
 * refraction is visible; several glass styles side by side for comparison.
 * Opened from Settings → "Liquid Glass lab".
 */
export default function GlassDemo({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] overflow-y-auto"
      role="dialog" aria-modal="true" aria-label="Liquid Glass demo"
    >
      {/* vivid backdrop: warm sunset gradient + blobs */}
      <div className="fixed inset-0" aria-hidden style={{
        background:
          'radial-gradient(90% 55% at 15% 10%, #ffd968 0%, transparent 60%),' +
          'radial-gradient(80% 50% at 85% 20%, #e85d26 0%, transparent 62%),' +
          'radial-gradient(90% 60% at 50% 90%, #c2452d 0%, transparent 60%),' +
          'linear-gradient(160deg, #f5b800 0%, #e07b00 45%, #7a2d12 100%)',
      }} />
      <div className="relative mx-auto flex min-h-full w-full max-w-[480px] flex-col px-5 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/75">Material lab</p>
            <h2 className="track-tight text-[24px] font-bold text-white">Liquid Glass</h2>
          </div>
          <GlassButton size="circle" label="Close demo" onClick={onClose} className="!h-11 !w-11 text-white">
            <X size={18} />
          </GlassButton>
        </div>

        {/* tinted hero button */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <GlassButton size="home" variant="tinted" label="Home demo">
            <House size={25} strokeWidth={2} />
          </GlassButton>
          <p className="text-[12px] font-semibold text-white/85">tinted · primary</p>
        </div>

        {/* pill row */}
        <div className="mt-8 space-y-2.5">
          <GlassButton size="lg" variant="tinted" className="w-full"><Plus size={18} /> Quick add</GlassButton>
          <GlassButton size="lg" variant="regular" className="w-full text-white"><ArrowLeftRight size={18} /> Transfer</GlassButton>
          <GlassButton size="lg" variant="clear" className="w-full text-white"><Upload size={18} /> Import</GlassButton>
        </div>
        <p className="mt-2 text-center text-[12px] font-semibold text-white/85">tinted · regular · clear pills</p>

        {/* orb row */}
        <div className="mt-8 flex justify-center gap-4">
          {[Plus, ArrowLeftRight, Upload].map((Icon, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <GlassButton size="circle" variant={i === 0 ? 'tinted' : 'clear'} label={['Add', 'Send', 'Import'][i]} className={i === 0 ? '' : 'text-white'}>
                <Icon size={22} strokeWidth={2} />
              </GlassButton>
              <span className="text-[11px] font-semibold text-white/85">{['Add', 'Send', 'Import'][i]}</span>
            </div>
          ))}
        </div>

        {/* toolbar */}
        <div className="mt-8">
          <GlassBar className="flex h-[68px] items-center justify-around rounded-[24px]">
            {[House, ArrowLeftRight, Plus, Upload].map((Icon, i) => (
              <span key={i} className={i === 2
                ? 'flex h-11 w-11 items-center justify-center rounded-full bg-white/85 text-[#1c1500]'
                : 'flex h-11 w-11 items-center justify-center rounded-full text-white'}>
                <Icon size={20} strokeWidth={2} />
              </span>
            ))}
          </GlassBar>
          <p className="mt-2 text-center text-[12px] font-semibold text-white/85">floating toolbar · soft refraction</p>
        </div>

        <p className="mt-8 rounded-2xl bg-black/25 p-4 text-[12.5px] leading-relaxed text-white/90 backdrop-blur-sm">
          Refraction is rendered live by an SVG displacement filter. On browsers
          without <code>backdrop-filter: url()</code> support these same elements
          fall back to clean frosted glass — no errors, no layout shift.
        </p>
      </div>
    </motion.div>
  );
}
