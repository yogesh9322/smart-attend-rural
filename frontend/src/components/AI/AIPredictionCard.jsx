import React, { useState, useEffect } from 'react';
import { predictStudentAttendance } from '../../services/api';
import { FaRobot, FaExclamationTriangle, FaCheckCircle, FaSpinner } from 'react-icons/fa';

const AIPredictionCard = ({ studentId }) => {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPrediction = async () => {
      if (!studentId) return;
      setLoading(true);
      setError('');
      try {
        const res = await predictStudentAttendance(studentId);
        if (res.success && res.data) {
          setPrediction(res.data);
        }
      } catch (err) {
        console.error(err);
        setError('Prediction engine offline.');
      } finally {
        setLoading(false);
      }
    };
    fetchPrediction();
  }, [studentId]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow flex items-center justify-center py-8">
        <FaSpinner className="animate-spin text-xl text-primary mr-2" />
        <span className="text-xs text-gray-400 font-bold">Predicting attendance risk...</span>
      </div>
    );
  }

  if (error || !prediction) {
    return null;
  }

  const getRiskBadgeColor = (level) => {
    switch (level) {
      case 'Critical': return 'bg-red-100 border-red-200 text-red-700';
      case 'High': return 'bg-amber-100 border-amber-200 text-amber-800';
      case 'Medium': return 'bg-yellow-50 border-yellow-150 text-yellow-800';
      default: return 'bg-green-50 border-green-200 text-green-700';
    }
  };

  return (
    <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-sans">
      <div className="flex items-center gap-3.5">
        <span className="p-3.5 bg-green-50 text-[#2E7D32] border border-green-100 rounded-2xl flex items-center justify-center shrink-0">
          <FaRobot className="text-2xl animate-pulse" />
        </span>
        <div>
          <h4 className="text-xs font-extrabold text-gray-450 uppercase tracking-widest">AI Attendance Risk Prediction</h4>
          <h3 className="text-base font-black text-gray-800 mt-1">Absenteeism Risk Assessment</h3>
        </div>
      </div>

      <div className="flex-1 md:text-right flex items-center justify-end gap-3 flex-wrap md:flex-nowrap">
        <div className="text-left md:text-right">
          <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Attendance Probability</span>
          <span className="text-lg font-black text-gray-800 mt-0.5 block">{prediction.probability}%</span>
        </div>
        <div className={`px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${getRiskBadgeColor(prediction.riskLevel)}`}>
          {prediction.riskLevel === 'Low' ? <FaCheckCircle /> : <FaExclamationTriangle />}
          <span>{prediction.riskLevel} Risk</span>
        </div>
      </div>

      <div className="w-full md:border-l md:border-gray-100 md:pl-4 pt-3 md:pt-0">
        <p className="text-xs text-gray-600 font-semibold leading-relaxed">
          {prediction.predictionText}
        </p>
      </div>
    </div>
  );
};

export default AIPredictionCard;
