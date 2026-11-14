import React from 'react';
import { FundingGapCalculator, RateTable } from '../finance';

const FinancialTracking = () => {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Financial Tracking</h1>
      <FundingGapCalculator />
      <RateTable title="Rate Table – Standard Unit Rates" />
    </div>
  );
};

export default FinancialTracking;
