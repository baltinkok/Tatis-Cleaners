import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Upload, FileText, Shield, CheckCircle } from 'lucide-react';

const CleanerApplication = () => {
  const { user, token } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    ssn: '',
    date_of_birth: '',
    address: '',
    city: '',
    state: 'AZ',
    zip_code: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    has_vehicle: true,
    has_cleaning_experience: true,
    years_experience: 0,
    hourly_rate: 40,
    service_areas: [],
    specialties: []
  });
  const [documents, setDocuments] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applicationId, setApplicationId] = useState(null);

  const apiUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  const serviceAreas = [
    'Tempe', 'Chandler', 'Gilbert', 'Mesa', 'Phoenix', 'Glendale', 'Scottsdale', 'Avondale'
  ];

  const specialtyOptions = [
    'Deep Cleaning', 'Regular Cleaning', 'Move In/Out Cleaning', 'Bathroom Cleaning',
    'Kitchen Cleaning', 'Window Cleaning', 'Carpet Cleaning', 'Post-Construction Cleanup'
  ];

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleArrayChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: prev[name].includes(value)
        ? prev[name].filter(item => item !== value)
        : [...prev[name], value]
    }));
  };

  const handleFileUpload = async (documentType, file) => {
    if (!applicationId) {
      setError('Please submit your application first');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target.result.split(',')[1];
        
        const uploadData = {
          application_id: applicationId,
          document_type: documentType,
          file_name: file.name,
          file_data: base64Data
        };

        const response = await fetch(`${apiUrl}/api/cleaner/upload-document`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(uploadData)
        });

        if (response.ok) {
          const result = await response.json();
          setDocuments(prev => ({
            ...prev,
            [documentType]: {
              name: file.name,
              uploaded: true
            }
          }));
        } else {
          const errorData = await response.json();
          setError(errorData.detail || 'Failed to upload document');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setError('Failed to upload document');
    }
  };

  const submitApplication = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiUrl}/api/cleaner/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setApplicationId(data.application_id);
        setCurrentStep(2);
      } else {
        setError(data.detail || 'Failed to submit application');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const requiredDocuments = [
    { type: 'id_front', label: 'ID Front', description: 'Front side of government-issued ID' },
    { type: 'id_back', label: 'ID Back', description: 'Back side of government-issued ID' },
    { type: 'ssn_card', label: 'SSN Card', description: 'Social Security card or W-2' },
    { type: 'work_permit', label: 'Work Permit', description: 'Work authorization (if applicable)' }
  ];

  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center mb-8">
              <Shield className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900">Cleaner Application</h1>
              <p className="text-gray-600">Join our team of professional cleaners</p>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <form className="space-y-6">
              {/* Personal Information */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Social Security Number
                    </label>
                    <input
                      type="text"
                      name="ssn"
                      value={formData.ssn}
                      onChange={handleInputChange}
                      placeholder="123456789"
                      maxLength={9}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      name="date_of_birth"
                      value={formData.date_of_birth}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Address</h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Street Address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="City"
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                    <select
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="AZ">Arizona</option>
                    </select>
                    <input
                      type="text"
                      name="zip_code"
                      value={formData.zip_code}
                      onChange={handleInputChange}
                      placeholder="Zip Code"
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Emergency Contact</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    name="emergency_contact_name"
                    value={formData.emergency_contact_name}
                    onChange={handleInputChange}
                    placeholder="Contact Name"
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <input
                    type="tel"
                    name="emergency_contact_phone"
                    value={formData.emergency_contact_phone}
                    onChange={handleInputChange}
                    placeholder="Contact Phone"
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Work Information */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Work Information</h2>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="has_vehicle"
                        checked={formData.has_vehicle}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">I have reliable transportation</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="has_cleaning_experience"
                        checked={formData.has_cleaning_experience}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">I have cleaning experience</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Years of Experience
                      </label>
                      <input
                        type="number"
                        name="years_experience"
                        value={formData.years_experience}
                        onChange={handleInputChange}
                        min="0"
                        max="50"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Desired Hourly Rate ($)
                      </label>
                      <input
                        type="number"
                        name="hourly_rate"
                        value={formData.hourly_rate}
                        onChange={handleInputChange}
                        min="15"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Areas */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Service Areas</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {serviceAreas.map(area => (
                    <label key={area} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.service_areas.includes(area)}
                        onChange={() => handleArrayChange('service_areas', area)}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{area}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Specialties */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Specialties</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {specialtyOptions.map(specialty => (
                    <label key={specialty} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.specialties.includes(specialty)}
                        onChange={() => handleArrayChange('specialties', specialty)}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{specialty}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  onClick={submitApplication}
                  disabled={loading}
                  className="w-full bg-emerald-600 text-white py-3 px-4 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === 2) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center mb-8">
              <FileText className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900">Document Upload</h1>
              <p className="text-gray-600">Please upload the required documents</p>
            </div>

            <div className="space-y-6">
              {requiredDocuments.map(doc => (
                <div key={doc.type} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{doc.label}</h3>
                      <p className="text-sm text-gray-600">{doc.description}</p>
                    </div>
                    {documents[doc.type]?.uploaded && (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    )}
                  </div>

                  {documents[doc.type]?.uploaded ? (
                    <div className="bg-green-50 p-4 rounded-md">
                      <p className="text-green-800">✓ {documents[doc.type].name} uploaded successfully</p>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            handleFileUpload(doc.type, file);
                          }
                        }}
                        className="hidden"
                        id={`upload-${doc.type}`}
                      />
                      <label
                        htmlFor={`upload-${doc.type}`}
                        className="cursor-pointer text-emerald-600 hover:text-emerald-700"
                      >
                        Click to upload or drag and drop
                      </label>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG, or PDF up to 10MB</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-blue-900 mb-2">Next Steps</h3>
                <p className="text-blue-800 text-sm">
                  After uploading all documents, our team will review your application and initiate a background check. 
                  You'll receive email updates about your application status.
                </p>
              </div>

              <button
                onClick={() => window.location.href = '/cleaner/dashboard'}
                className="bg-emerald-600 text-white py-2 px-6 rounded-md hover:bg-emerald-700"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export default CleanerApplication;