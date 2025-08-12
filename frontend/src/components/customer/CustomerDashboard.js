import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Star, DollarSign, Clock, User, ChevronRight } from 'lucide-react';

const CustomerDashboard = () => {
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
      const response = await fetch(`${apiUrl}/api/customer/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else {
        setError('Failed to load dashboard data');
      }
    } catch (error) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (booking) => {
    // Redirect to booking page with pre-filled data
    const bookingData = {
      service_type: booking.service_type,
      cleaner_id: booking.cleaner_id,
      hours: booking.hours,
      location: booking.location
    };
    
    // Store in sessionStorage for the booking page
    sessionStorage.setItem('reorderData', JSON.stringify(bookingData));
    window.location.href = '/#book-now';
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
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            Try Again
          </button>
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
                Welcome back, {user?.first_name}!
              </h1>
              <p className="text-gray-600">Manage your cleaning services</p>
            </div>
            <button
              onClick={() => window.location.href = '/#book-now'}
              className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Book New Cleaning
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-emerald-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_bookings || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed_bookings || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold text-gray-900">{stats.upcoming_bookings || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">${stats.total_spent || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Bookings */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Recent Bookings</h2>
            </div>
            <div className="p-6">
              {dashboardData?.recent_bookings?.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.recent_bookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{booking.service_type}</h3>
                        <p className="text-sm text-gray-600">{booking.cleaner_name}</p>
                        <p className="text-sm text-gray-500">{booking.date} at {booking.time}</p>
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                          booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                          booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-900">${booking.total_amount}</span>
                        {booking.status === 'completed' && (
                          <button
                            onClick={() => handleReorder(booking)}
                            className="px-3 py-1 text-sm bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors"
                          >
                            Reorder
                          </button>
                        )}
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No bookings yet</p>
                  <button
                    onClick={() => window.location.href = '/#book-now'}
                    className="mt-2 text-emerald-600 hover:text-emerald-700"
                  >
                    Book your first cleaning
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Favorite Cleaners */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Favorite Cleaners</h2>
            </div>
            <div className="p-6">
              {stats.favorite_cleaners?.length > 0 ? (
                <div className="space-y-4">
                  {stats.favorite_cleaners.map((item) => (
                    <div key={item.cleaner.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        <User className="h-10 w-10 text-gray-400 bg-gray-100 rounded-full p-2" />
                        <div className="ml-4">
                          <h3 className="font-medium text-gray-900">{item.cleaner.name}</h3>
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="text-sm text-gray-600 ml-1">{item.cleaner.rating}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">{item.booking_count} bookings</p>
                        <button
                          onClick={() => {
                            sessionStorage.setItem('preferredCleaner', item.cleaner.id);
                            window.location.href = '/#book-now';
                          }}
                          className="text-sm text-emerald-600 hover:text-emerald-700"
                        >
                          Book Again
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No favorite cleaners yet</p>
                  <p className="text-sm text-gray-500">Complete bookings to see your favorites</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => window.location.href = '/#book-now'}
              className="p-4 border-2 border-emerald-200 rounded-lg text-center hover:border-emerald-300 transition-colors"
            >
              <Calendar className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
              <h3 className="font-medium text-gray-900">Book New Service</h3>
              <p className="text-sm text-gray-600">Schedule a new cleaning</p>
            </button>

            <button className="p-4 border-2 border-gray-200 rounded-lg text-center hover:border-gray-300 transition-colors">
              <Clock className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <h3 className="font-medium text-gray-900">View All Bookings</h3>
              <p className="text-sm text-gray-600">See booking history</p>
            </button>

            <button className="p-4 border-2 border-gray-200 rounded-lg text-center hover:border-gray-300 transition-colors">
              <User className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <h3 className="font-medium text-gray-900">Profile Settings</h3>
              <p className="text-sm text-gray-600">Update your information</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;