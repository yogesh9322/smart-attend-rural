import React, { useState } from 'react';
import { parseLeaveDocumentOCR } from '../../services/api';
import { FaUpload, FaRobot, FaSpinner, FaRegCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

const AIOCRLeaveUpload = ({ onExtracted }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extractedData, setExtractedData] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setExtractedData(null);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    setError('');

    try {
      const res = await parseLeaveDocumentOCR(formData);
      if (res.success && res.data) {
        setExtractedData(res.data);
        if (onExtracted) {
          onExtracted(res.data);
        }
      } else {
        setError(res.message || 'Failed to extract certificate parameters.');
      }
    } catch (err) {
      console.error(err);
      setError('OCR document scanning failed. Try typing leave fields manually.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-md space-y-4 font-sans">
      <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5 uppercase tracking-wider pb-2 border-b border-gray-100">
        <FaRobot className="text-[#2E7D32]" />
        <span>AI Medical Certificate OCR scanner</span>
      </h3>

      <p className="text-[11px] text-gray-500 font-semibold leading-relaxed">
        Upload a medical note or leave document. Our AI scans credentials to automatically fill the leave dates, child index, and medical reasons.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <input
          type="file"
          id="certFile"
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,application/pdf"
        />
        <label
          htmlFor="certFile"
          className="flex items-center justify-center gap-2 w-full sm:flex-1 py-3 px-4 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 rounded-xl text-xs font-bold text-gray-600 cursor-pointer transition"
        >
          <FaUpload />
          <span>{file ? file.name : 'Select Certificate File'}</span>
        </label>
        
        <button
          onClick={handleUpload}
          disabled={loading || !file}
          className="w-full sm:w-max px-6 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <FaSpinner className="animate-spin" />
              <span>Scanning document...</span>
            </>
          ) : (
            <span>Scan & Auto-Fill</span>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-150 text-red-700 text-xs font-bold rounded-xl flex items-center gap-1.5">
          <FaExclamationTriangle className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {extractedData && (
        <div className="p-3.5 bg-green-50 border border-green-200 text-green-800 text-xs font-bold rounded-2xl flex items-start gap-2.5">
          <FaRegCheckCircle className="text-base text-green-700 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-green-900 font-black">AI Parameters Extracted successfully:</p>
            <ul className="list-disc list-inside space-y-0.5 text-[10px] text-green-700 font-semibold mt-1">
              <li>Student Name: {extractedData.studentName}</li>
              <li>Doctor Name: {extractedData.doctorName}</li>
              <li>Leave Dates: {extractedData.leaveDates}</li>
              <li>Extracted Reason: "{extractedData.reason}"</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIOCRLeaveUpload;
