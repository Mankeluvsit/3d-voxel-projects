import React from 'react';
import { BuildingType } from '../../types';
import { BUILDINGS } from '../../constants';

export const ToolButton: React.FC<{
  type: BuildingType;
  isSelected: boolean;
  onClick: () => void;
  money: number;
  level: number;
  isSandbox: boolean;
}> = ({ type, isSelected, onClick, money, level, isSandbox }) => {
  const config = BUILDINGS[type];
  const canAfford = isSandbox || money >= config.cost;
  const isUnlocked = isSandbox || level >= config.unlockLevel;
  const isBulldoze = type === BuildingType.None;
  
  // Use 3D color for preview
  const bgColor = isBulldoze ? config.color : config.color;

  return (
    <button
      onClick={onClick}
      disabled={!isBulldoze && (!canAfford || !isUnlocked)}
      className={`
        relative flex flex-col items-center justify-center rounded-lg border-2 transition-all shadow-lg backdrop-blur-sm flex-shrink-0
        w-14 h-14 md:w-16 md:h-16
        ${isSelected ? 'border-white bg-white/20 scale-110 z-10' : 'border-gray-600 bg-gray-900/80 hover:bg-gray-800'}
        ${!isBulldoze && (!canAfford || !isUnlocked) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={isUnlocked ? config.description : `Unlocks at level ${config.unlockLevel}`}
    >
      <div className="w-6 h-6 md:w-8 md:h-8 rounded mb-0.5 md:mb-1 border border-black/30 shadow-inner flex items-center justify-center overflow-hidden" style={{ backgroundColor: isBulldoze ? 'transparent' : bgColor }}>
        {isBulldoze && <div className="w-full h-full bg-red-600 text-white flex justify-center items-center font-bold text-base md:text-lg">✕</div>}
        {type === BuildingType.Road && <div className="w-full h-2 bg-gray-800 transform -rotate-45"></div>}
        {!isUnlocked && <span className="text-xs font-bold text-gray-500">🔒</span>}
      </div>
      <span className="text-[8px] md:text-[10px] font-bold text-white uppercase tracking-wider drop-shadow-md leading-none">{config.name}</span>
      {!isSandbox && config.cost > 0 && isUnlocked && (
        <span className={`text-[8px] md:text-[10px] font-mono leading-none ${canAfford ? 'text-green-300' : 'text-red-400'}`}>${config.cost}</span>
      )}
    </button>
  );
};
