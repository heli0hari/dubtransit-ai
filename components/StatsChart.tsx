import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const data = [
  { name: '06:00', load: 20 },
  { name: '08:00', load: 85 },
  { name: '10:00', load: 45 },
  { name: '12:00', load: 50 },
  { name: '14:00', load: 55 },
  { name: '17:00', load: 95 },
  { name: '19:00', load: 60 },
  { name: '21:00', load: 30 },
];

export const StatsChart: React.FC = () => {
  return (
    <div className="h-64 w-full">
      <h3 className="text-[10px] font-black text-neutral-400 mb-4 uppercase tracking-widest">Forecasted Network Load</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
          <XAxis 
            dataKey="name" 
            stroke="#a3a3a3" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false} 
            tick={{fontWeight: 'bold'}}
          />
          <YAxis 
            stroke="#a3a3a3" 
            fontSize={10} 
            tickLine={false} 
            axisLine={false} 
            unit="%"
          />
          <Tooltip 
            cursor={{fill: '#f5f5f5'}}
            contentStyle={{ backgroundColor: '#171717', borderColor: '#171717', color: '#f5f5f5', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}
          />
          <Bar dataKey="load" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.load > 80 ? '#E3CC00' : '#171717'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};