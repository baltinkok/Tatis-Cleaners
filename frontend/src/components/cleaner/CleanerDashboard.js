import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Star, DollarSign, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const CleanerDashboard = () => {
  const { user, token } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const apiUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/cleaner/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else if (response.status === 404) {
        setError('Cleaner profile not found. Please complete your application first.');
      } else {
        setError('Failed to load dashboard data');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleBookingResponse = async (bookingId, accepted, reason = null) => {
    try {
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          booking_id: bookingId,
          accepted,
          reason
        })
      });

      if (response.ok) {
        // Refresh dashboard data
        fetchDashboardData();
      } else {
        alert('Failed to process booking response');
      }
    } catch (error) {
      alert('Network error occurred');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          {error.includes('application') ? (
            <button
              onClick={() => window.location.href = '/cleaner/apply'}
              className="px-6 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
            >
              Complete Application
            </button>
          ) : (
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  const stats = dashboardData?.stats || {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome, {user?.first_name}!
              </h1>
              <p className="text-gray-600">Your cleaning dashboard</p>
            </div>
            {stats.pending_requests > 0 && (
              <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg">
                {stats.pending_requests} pending request{stats.pending_requests !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-emerald-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_jobs || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed_jobs || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold text-gray-900">{stats.upcoming_jobs || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Earnings</p>
                <p className="text-2xl font-bold text-gray-900">${stats.total_earnings || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Star className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Rating</p>
                <p className="text-2xl font-bold text-gray-900">{stats.average_rating || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pending Job Requests */}
          {dashboardData?.pending_jobs?.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Pending Requests</h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {dashboardData.pending_jobs.map((job) => (
                    <div key={job.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-medium text-gray-900">{job.service_type}</h3>
                          <p className="text-sm text-gray-600">{job.customer_name}</p>
                          <p className="text-sm text-gray-500">{job.date} at {job.time}</p>
                          <p className="text-sm text-gray-500">{job.address}</p>
                          <p className="font-semibold text-green-600">${job.total_amount}</p>
                        </div>
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                          {job.hours} hours
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleBookingResponse(job.id, true)}
                          className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => {
                            const reason = window.prompt('Reason for declining (optional):');
                            handleBookingResponse(job.id, false, reason);
                          }}
                          className="flex-1 bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Jobs */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Upcoming Jobs</h2>
            </div>
            <div className="p-6">
              {dashboardData?.upcoming_jobs?.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.upcoming_jobs.map((job) => (
                    <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900">{job.service_type}</h3>
                          <p className="text-sm text-gray-600">{job.customer_name}</p>
                          <p className="text-sm text-gray-500">{job.date} at {job.time}</p>
                          <p className="text-sm text-gray-500">{job.address}</p>
                          <p className="font-semibold text-green-600">${job.total_amount}</p>
                        </div>
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          {job.hours} hours
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No upcoming jobs</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Recent Jobs</h2>
            </div>
            <div className="p-6">
              {dashboardData?.recent_jobs?.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.recent_jobs.map((job) => (
                    <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900">{job.service_type}</h3>
                          <p className="text-sm text-gray-600">{job.customer_name}</p>
                          <p className="text-sm text-gray-500">{job.date} at {job.time}</p>
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                            job.status === 'completed' ? 'bg-green-100 text-green-800' :
                            job.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        <span className="font-semibold text-green-600">${job.total_amount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No recent jobs</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button className="p-4 border-2 border-gray-200 rounded-lg text-center hover:border-gray-300 transition-colors">
              <Calendar className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <h3 className="font-medium text-gray-900">Manage Schedule</h3>
              <p className="text-sm text-gray-600">Update availability</p>
            </button>

            <button className="p-4 border-2 border-gray-200 rounded-lg text-center hover:border-gray-300 transition-colors">
              <DollarSign className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <h3 className="font-medium text-gray-900">View Earnings</h3>
              <p className="text-sm text-gray-600">Payment history</p>
            </button>

            <button className="p-4 border-2 border-gray-200 rounded-lg text-center hover:border-gray-300 transition-colors">
              <Star className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <h3 className="font-medium text-gray-900">Customer Reviews</h3>
              <p className="text-sm text-gray-600">See feedback</p>
            </button>

            <button className="p-4 border-2 border-gray-200 rounded-lg text-center hover:border-gray-300 transition-colors">
              <Clock className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <h3 className="font-medium text-gray-900">Profile Settings</h3>
              <p className="text-sm text-gray-600">Update information</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CleanerDashboard;