import React from 'react';
import { ClassDEstimator } from '../finance';

const ClassDEstimates = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Class D Cost Estimates</h1>
      <ClassDEstimator title="Clearwater Ridge Wildfire – Class D Estimate" />
    </div>
  );
};

export default ClassDEstimates;
