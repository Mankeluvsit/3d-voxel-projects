import { createContext } from 'react';

export const LODContext = createContext<{ lodLevel: 'high' | 'low' }>({ lodLevel: 'high' });
