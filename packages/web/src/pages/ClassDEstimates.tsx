import React from 'react';
import {
  BasisOfEstimateForm,
  ClassDEstimator,
  getEstimateLines,
  setEstimateLines,
} from '../finance';

const ClassDEstimates = () => {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Class D Cost Estimates</h1>
      {/* Lines are kept in the shared estimate store so they survive page
          switches and feed the Funding Gap Calculator and the BOE. */}
      <ClassDEstimator
        title="Clearwater Ridge Wildfire – Class D Estimate"
        initialLines={getEstimateLines()}
        onChange={setEstimateLines}
      />
      <BasisOfEstimateForm />
    </div>
  );
};

export default ClassDEstimates;
