import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Star, 
  User, 
  CheckCircle, 
  CreditCard,
  Loader,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  Award,
  Briefcase,
  Home
} from 'lucide-react';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.jsx';
import { Input } from './ui/input.jsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion.jsx';
import { ENV_CONFIG } from '../config/environment';

// Memoize the backend URL to prevent re-renders
const BACKEND_URL = ENV_CONFIG.backendUrl;

function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [services, setServices] = useState({});
  const [cleaners, setCleaners] = useState([]);
  const [serviceAreas, setServiceAreas] = useState([]);
  const [selectedService, setSelectedService] = useState('');
  const [selectedCleaner, setSelectedCleaner] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedHours, setSelectedHours] = useState(2);
  const [selectedArea, setSelectedArea] = useState('');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    instructions: ''
  });
  const [booking, setBooking] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadServices();
    loadCleaners();
    loadServiceAreas();
    checkPaymentReturn();
  }, []); // Remove cleaners dependency to prevent infinite loop

  // Handle reorder data and preferred cleaner after cleaners are loaded
  useEffect(() => {
    if (cleaners && cleaners.length > 0) {
      // Load reorder data if exists
      const reorderData = sessionStorage.getItem('reorderData');
      if (reorderData) {
        const data = JSON.parse(reorderData);
        setSelectedService(data.service_type);
        setSelectedCleaner(cleaners.find(c => c.id === data.cleaner_id));
        setSelectedHours(data.hours);
        setSelectedArea(data.location);
        setCurrentStep(2); // Skip to cleaner selection
        sessionStorage.removeItem('reorderData');
      }
      
      // Check for preferred cleaner
      const preferredCleaner = sessionStorage.getItem('preferredCleaner');
      if (preferredCleaner) {
        setSelectedCleaner(cleaners.find(c => c.id === preferredCleaner));
        sessionStorage.removeItem('preferredCleaner');
      }
    }
  }, [cleaners]); // Only depend on cleaners

  // Auto-fill customer info if authenticated
  useEffect(() => {
    if (isAuthenticated() && user) {
      setCustomerInfo(prev => ({
        ...prev,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        phone: user.phone || ''
      }));
    }
  }, [user, isAuthenticated]);

  const loadServices = async () => {
    try {
      console.log('🔄 Loading services from:', `${BACKEND_URL}/api/services`);
      const response = await fetch(`${BACKEND_URL}/api/services`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Services loaded successfully:', Object.keys(data.services || {}));
      setServices(data.services || {});
    } catch (error) {
      console.error('❌ Error loading services:', error);
      console.log('🔍 Backend URL being used:', BACKEND_URL);
      
      // Set empty services to show error state
      setServices({});
    }
  };

  const loadCleaners = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/cleaners`);
      if (!response.ok) {
        console.warn('Cleaners API returned error:', response.status);
        setCleaners([]); // Set empty array as fallback
        return;
      }
      const data = await response.json();
      setCleaners(data.cleaners || []); // Ensure fallback to empty array
    } catch (error) {
      console.error('Error loading cleaners:', error);
      setCleaners([]); // Set empty array as fallback
    }
  };

  const loadServiceAreas = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/service-areas`);
      if (!response.ok) {
        console.warn('Service areas API returned error:', response.status);
        setServiceAreas([]); // Set empty array as fallback
        return;
      }
      const data = await response.json();
      setServiceAreas(data.areas || []); // Ensure fallback to empty array
    } catch (error) {
      console.error('Error loading service areas:', error);
      setServiceAreas([]); // Set empty array as fallback
    }
  };

  const checkPaymentReturn = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const bookingId = urlParams.get('booking_id');
    
    if (sessionId && bookingId) {
      setCurrentStep(6);
      pollPaymentStatus(sessionId, bookingId);
    }
  };

  const pollPaymentStatus = async (sessionId, bookingId, attempts = 0) => {
    const maxAttempts = 10;
    if (attempts >= maxAttempts) {
      setPaymentStatus('timeout');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/checkout/status/${sessionId}`);
      const data = await response.json();
      
      if (data.payment_status === 'paid') {
        setPaymentStatus('success');
        const bookingResponse = await fetch(`${BACKEND_URL}/api/bookings/${bookingId}`);
        const bookingData = await bookingResponse.json();
        setBooking(bookingData);
        return;
      } else if (data.status === 'expired') {
        setPaymentStatus('failed');
        return;
      }

      setTimeout(() => pollPaymentStatus(sessionId, bookingId, attempts + 1), 2000);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setPaymentStatus('error');
    }
  };

  const timeSlots = [
    '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
    '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'
  ];

  const handleNext = () => {
    console.log('🔄 handleNext called, current step:', currentStep);
    setCurrentStep(prev => {
      console.log('📈 Moving from step', prev, 'to step', prev + 1);
      return prev + 1;
    });
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleBooking = async () => {
    setIsLoading(true);
    try {
      const bookingData = {
        service_type: selectedService,
        cleaner_id: selectedCleaner.id,
        date: selectedDate.toISOString().split('T')[0],
        time: selectedTime,
        hours: selectedHours,
        location: selectedArea,
        address: customerInfo.address,
        customer_name: customerInfo.name,
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone,
        special_instructions: customerInfo.instructions
      };

      const response = await fetch(`${BACKEND_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData)
      });

      const result = await response.json();
      
      if (response.ok) {
        const bookingResult = { ...result, ...bookingData };
        setBooking(bookingResult);
        
        // Proceed directly to payment using the booking result
        try {
          const paymentData = {
            booking_id: result.booking_id,
            origin_url: window.location.origin
          };

          const paymentResponse = await fetch(`${BACKEND_URL}/api/checkout/session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(paymentData)
          });

          const paymentResult = await paymentResponse.json();
          
          if (paymentResponse.ok) {
            window.location.href = paymentResult.url;
          } else {
            alert('Error creating payment session: ' + paymentResult.detail);
          }
        } catch (paymentError) {
          console.error('Error creating payment session:', paymentError);
          alert('Booking created but error with payment. Please contact support.');
        }
      } else {
        alert('Error creating booking: ' + result.detail);
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Error creating booking. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      const paymentData = {
        booking_id: booking.booking_id,
        origin_url: window.location.origin
      };

      const response = await fetch(`${BACKEND_URL}/api/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();
      
      if (response.ok) {
        window.location.href = result.url;
      } else {
        alert('Error creating payment session: ' + result.detail);
      }
    } catch (error) {
      console.error('Error creating payment session:', error);
      alert('Error creating payment session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotal = () => {
    if (!selectedService || !services[selectedService]) return 0;
    return services[selectedService].base_price * selectedHours;
  };

  const isDisabled = (condition) => !condition;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with PWA indicator */}
      <div className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img
                src="https://customer-assets.emergentagent.com/job_cleanbook-1/artifacts/nww6p860_tatis-cleaners-high-resolution-logo.png"
                alt="Tati's Cleaners"
                className="h-12 w-12 rounded-full"
              />
              <h1 className="text-2xl font-bold text-slate-900">Tati's Cleaners</h1>
            </div>
            
            {/* Authentication buttons */}
            <div className="flex items-center space-x-4">
              {isAuthenticated() ? (
                <div className="flex items-center space-x-4">
                  <span className="text-slate-600">Hello, {user?.first_name}!</span>
                  <span className="px-3 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700">
                    {user?.role === 'customer' ? '👤 Customer' : user?.role === 'cleaner' ? '🧹 Cleaner' : '⚙️ Admin'}
                  </span>
                  <a
                    href={user?.role === 'customer' ? '/customer/dashboard' : '/cleaner/dashboard'}
                    className="text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Dashboard
                  </a>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <div className="relative group">
                    <Link
                      to="/login"
                      className="text-slate-600 hover:text-slate-900 font-medium"
                    >
                      Sign In
                    </Link>
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="p-4">
                        <div className="mb-3">
                          <div className="flex items-center space-x-2 text-sm text-emerald-600 mb-1">
                            <span>👤</span>
                            <span className="font-medium">For Customers:</span>
                          </div>
                          <p className="text-xs text-gray-600">View bookings, reorder services, rate cleaners</p>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 text-sm text-blue-600 mb-1">
                            <span>🧹</span>
                            <span className="font-medium">For Cleaners:</span>
                          </div>
                          <p className="text-xs text-gray-600">Manage jobs, track earnings, view schedule</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="relative group">
                    <Link
                      to="/register"
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-medium"
                    >
                      Sign Up
                    </Link>
                    <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <div className="p-4">
                        <div className="mb-3 pb-3 border-b">
                          <div className="flex items-center space-x-2 text-sm text-emerald-600 mb-2">
                            <span>👤</span>
                            <span className="font-medium">Join as Customer</span>
                          </div>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Book trusted cleaners</li>
                            <li>• Track service history</li>
                            <li>• Rate and review</li>
                            <li>• One-click reordering</li>
                          </ul>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 text-sm text-blue-600 mb-2">
                            <span>🧹</span>
                            <span className="font-medium">Join as Cleaner</span>
                          </div>
                          <ul className="text-xs text-gray-600 space-y-1">
                            <li>• Flexible work schedule</li>
                            <li>• Set your own rates</li>
                            <li>• Track earnings</li>
                            <li>• Background check included</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-emerald-50 to-blue-50 py-20">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&h=800&fit=crop')] bg-cover bg-center opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-blue-600/10"></div>
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="mb-8">
            <img
              src="https://customer-assets.emergentagent.com/job_cleanbook-1/artifacts/nww6p860_tatis-cleaners-high-resolution-logo.png"
              alt="Tati's Cleaners"
              className="h-24 w-24 mx-auto mb-6 rounded-full"
            />
          </div>
          <h1 className="text-5xl font-bold text-slate-900 mb-6">
            Professional Cleaning Services in Arizona
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Book trusted, experienced cleaners for your home or office. Quality service, competitive rates, and 100% satisfaction guaranteed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => {
                console.log('🔘 Book Now clicked');
                const bookingSection = document.getElementById('book-now');
                if (bookingSection) {
                  bookingSection.scrollIntoView({ behavior: 'smooth' });
                  console.log('📜 Scrolling to booking section');
                } else {
                  console.error('❌ Booking section not found');
                }
              }}
              size="lg" 
              className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-4"
            >
              Book Now
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 text-lg px-8 py-4"
              onClick={() => window.open('tel:+18337358284')}
            >
              <Phone className="w-5 h-5 mr-2" />
              Call (833) 735-TATI
            </Button>
          </div>
        </div>
      </div>

      {/* User Types Section */}
      <section className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Join Tati's Cleaners</h2>
            <p className="text-xl text-slate-600">Whether you need cleaning services or want to provide them</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* For Customers */}
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">👤</span>
              </div>
              <h3 className="text-2xl font-bold text-emerald-700 mb-4">For Customers</h3>
              <p className="text-slate-600 mb-6">Book trusted, professional cleaners for your home or office</p>
              
              <div className="text-left mb-6">
                <h4 className="font-semibold text-slate-900 mb-3">What you get:</h4>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mr-2" />
                    Book verified, insured cleaners
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mr-2" />
                    Track your service history
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mr-2" />
                    Rate and review cleaners
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mr-2" />
                    One-click reordering
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mr-2" />
                    Secure online payments
                  </li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <Link
                  to="/register?role=customer"
                  className="w-full bg-emerald-600 text-white py-3 px-6 rounded-lg hover:bg-emerald-700 transition-colors inline-block"
                >
                  Sign Up as Customer
                </Link>
                <p className="text-xs text-slate-500">
                  Already have an account? <Link to="/login" className="text-emerald-600 hover:text-emerald-700">Sign In</Link>
                </p>
              </div>
            </div>

            {/* For Cleaners */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">🧹</span>
              </div>
              <h3 className="text-2xl font-bold text-blue-700 mb-4">For Cleaners</h3>
              <p className="text-slate-600 mb-6">Join our network of professional cleaning service providers</p>
              
              <div className="text-left mb-6">
                <h4 className="font-semibold text-slate-900 mb-3">What you get:</h4>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-blue-600 mr-2" />
                    Flexible work schedule
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-blue-600 mr-2" />
                    Set your own hourly rates
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-blue-600 mr-2" />
                    Accept/decline job offers
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-blue-600 mr-2" />
                    Track earnings and performance
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-blue-600 mr-2" />
                    Background check included
                  </li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <Link
                  to="/register?role=cleaner"
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors inline-block"
                >
                  Apply as Cleaner
                </Link>
                <p className="text-xs text-slate-500">
                  Already registered? <Link to="/login" className="text-blue-600 hover:text-blue-700">Sign In</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BOOKING SECTION */}
      <section className="bg-white py-16" id="book-now">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Book Your Cleaning Service</h2>
            <p className="text-xl text-slate-600">Choose your service, cleaner, and schedule in just a few steps</p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center mb-12">
            <div className="flex items-center space-x-4">
              {[1, 2, 3, 4, 5].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {step}
                  </div>
                  {step < 5 && (
                    <div className={`w-16 h-1 mx-2 ${
                      currentStep > step ? 'bg-emerald-600' : 'bg-slate-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="bg-slate-50 rounded-xl p-8">
            {currentStep === 1 && (
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Choose Your Service</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(services).map(([serviceType, service]) => (
                    <Card 
                      key={serviceType}
                      className={`cursor-pointer transition-all ${
                        selectedService === serviceType 
                          ? 'ring-2 ring-emerald-600 bg-emerald-50' 
                          : 'hover:shadow-lg'
                      }`}
                      onClick={() => setSelectedService(serviceType)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-bold text-slate-900">
                            {service.name}
                          </h4>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-emerald-600">
                              ${service.base_price}/hr
                            </div>
                          </div>
                        </div>
                        <p className="text-slate-600 text-sm mb-4">
                          {service.description}
                        </p>
                        <div className="text-xs text-slate-500">
                          <strong>What's included:</strong>
                          <ul className="list-disc pl-5 mt-1">
                            {service.features.map((feature, idx) => (
                              <li key={idx}>{feature}</li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-end mt-8">
                  <Button 
                    onClick={handleNext}
                    disabled={!selectedService}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Next: Choose Cleaner
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Choose Your Cleaner</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {cleaners.map((cleaner) => (
                    <Card 
                      key={cleaner.id}
                      className={`cursor-pointer transition-all ${
                        selectedCleaner?.id === cleaner.id 
                          ? 'ring-2 ring-emerald-600 bg-emerald-50' 
                          : 'hover:shadow-lg'
                      }`}
                      onClick={() => setSelectedCleaner(cleaner)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                            <User className="w-8 h-8 text-emerald-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-bold text-slate-900">
                              {cleaner.name}
                            </h4>
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="flex items-center">
                                {[...Array(5)].map((_, i) => (
                                  <Star 
                                    key={i} 
                                    className={`w-4 h-4 ${
                                      i < Math.floor(cleaner.rating) 
                                        ? 'text-yellow-400 fill-current' 
                                        : 'text-slate-300'
                                    }`} 
                                  />
                                ))}
                              </div>
                              <span className="text-sm text-slate-600">
                                {cleaner.rating} ({cleaner.reviews_count} reviews)
                              </span>
                            </div>
                            <p className="text-sm text-slate-600">
                              {cleaner.experience_years} years experience
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {cleaner.specialties?.slice(0, 3).map((specialty, idx) => (
                                <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">
                                  {specialty}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-between mt-8">
                  <Button 
                    variant="outline" 
                    onClick={handleBack}
                    className="border-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button 
                    onClick={handleNext}
                    disabled={!selectedCleaner}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Next: Schedule
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Schedule Your Cleaning</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Date and Time Selection */}
                  <div>
                    <h4 className="text-lg font-medium text-slate-900 mb-4">Select Date & Time</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Preferred Date
                        </label>
                        <Input
                          type="date"
                          min={new Date().toISOString().split('T')[0]}
                          value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                          onChange={(e) => setSelectedDate(new Date(e.target.value))}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Preferred Time
                        </label>
                        <select 
                          value={selectedTime}
                          onChange={(e) => setSelectedTime(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">Select time</option>
                          {timeSlots.map(time => (
                            <option key={time} value={time}>{time}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Duration (hours)
                        </label>
                        <select 
                          value={selectedHours}
                          onChange={(e) => setSelectedHours(parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(hour => (
                            <option key={hour} value={hour}>{hour} hour{hour > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Service Area Selection */}
                  <div>
                    <h4 className="text-lg font-medium text-slate-900 mb-4">Service Area</h4>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        City
                      </label>
                      <select 
                        value={selectedArea}
                        onChange={(e) => setSelectedArea(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Select your city</option>
                        {serviceAreas.map(area => (
                          <option key={area} value={area}>{area}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <Button 
                    variant="outline" 
                    onClick={handleBack}
                    className="border-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button 
                    onClick={handleNext}
                    disabled={!selectedDate || !selectedTime || !selectedArea}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Next: Details
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Contact Details</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Full Name *
                      </label>
                      <Input
                        value={customerInfo.name}
                        onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Email Address *
                      </label>
                      <Input
                        type="email"
                        value={customerInfo.email}
                        onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Phone Number *
                      </label>
                      <Input
                        type="tel"
                        value={customerInfo.phone}
                        onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                        placeholder="Enter your phone number"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Service Address *
                      </label>
                      <Input
                        value={customerInfo.address}
                        onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                        placeholder="Enter full address"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Special Instructions
                      </label>
                      <textarea
                        value={customerInfo.instructions}
                        onChange={(e) => setCustomerInfo({...customerInfo, instructions: e.target.value})}
                        placeholder="Any special requests or instructions..."
                        rows={4}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <Button 
                    variant="outline" 
                    onClick={handleBack}
                    className="border-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button 
                    onClick={handleNext}
                    disabled={!customerInfo.name || !customerInfo.email || !customerInfo.phone || !customerInfo.address}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Review Booking
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Review & Confirm</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Booking Summary */}
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Service Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Service:</span>
                          <span className="font-medium">{services[selectedService]?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Cleaner:</span>
                          <span className="font-medium">{selectedCleaner?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Date:</span>
                          <span className="font-medium">{selectedDate?.toDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Time:</span>
                          <span className="font-medium">{selectedTime}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Duration:</span>
                          <span className="font-medium">{selectedHours} hour{selectedHours > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Location:</span>
                          <span className="font-medium">{selectedArea}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Contact Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Name:</span>
                          <span className="font-medium">{customerInfo.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Email:</span>
                          <span className="font-medium">{customerInfo.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Phone:</span>
                          <span className="font-medium">{customerInfo.phone}</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Address:</span>
                          <p className="font-medium mt-1">{customerInfo.address}</p>
                        </div>
                        {customerInfo.instructions && (
                          <div>
                            <span className="text-slate-600">Instructions:</span>
                            <p className="font-medium mt-1">{customerInfo.instructions}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Pricing */}
                  <div>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Pricing Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-slate-600">
                            {services[selectedService]?.name} × {selectedHours} hour{selectedHours > 1 ? 's' : ''}
                          </span>
                          <span className="font-medium">
                            ${services[selectedService]?.base_price} × {selectedHours}
                          </span>
                        </div>
                        <div className="border-t pt-4">
                          <div className="flex justify-between text-xl font-bold">
                            <span>Total:</span>
                            <span className="text-emerald-600">${calculateTotal()}</span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-500 mt-4">
                          * Payment will be processed securely via Stripe
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <Button 
                    variant="outline" 
                    onClick={handleBack}
                    className="border-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button 
                    onClick={handleBooking}
                    disabled={isLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-3"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Book & Pay ${calculateTotal()}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-slate-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <HelpCircle className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-slate-900 mb-4">❓ Frequently Asked Questions</h2>
            <p className="text-slate-600">Everything you need to know about our cleaning services</p>
          </div>
          
          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem value="item-0" className="bg-white rounded-lg border">
              <AccordionTrigger className="px-6 py-4 text-left">
                How much do your cleaning services cost?
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                <div className="text-slate-600">
                  <p>Our pricing is simple and transparent:</p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li><strong>Regular Cleaning:</strong> $40/hour per cleaner</li>
                    <li><strong>Deep Cleaning:</strong> $45/hour per cleaner</li>
                    <li><strong>Move In/Out Cleaning:</strong> $70/hour per cleaner</li>
                    <li><strong>Janitorial Services:</strong> $70/hour per cleaner</li>
                  </ul>
                  <p className="mt-2">All prices are per cleaner, per hour. You can select the number of hours based on your specific needs.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-1" className="bg-white rounded-lg border">
              <AccordionTrigger className="px-6 py-4 text-left">
                How long does a residential basic cleaning take for a 1-bedroom, 1-bathroom apartment?
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                <div className="text-slate-600 space-y-3">
                  <p>For a standard 1-bedroom, 1-bathroom apartment (approximately 600-800 sq ft), our basic cleaning service typically takes:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>2-3 hours</strong> with one cleaner</li>
                    <li><strong>1.5-2 hours</strong> with two cleaners working together</li>
                  </ul>
                  <p>This includes dusting, vacuuming, mopping, bathroom cleaning, kitchen cleaning, and general tidying. Time may vary based on the apartment's condition and specific cleaning requests.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-white rounded-lg border">
              <AccordionTrigger className="px-6 py-4 text-left">
                How long does a deep cleaning take for a 1-bedroom, 1-bathroom apartment?
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                <div className="text-slate-600 space-y-3">
                  <p>Deep cleaning for a 1-bedroom, 1-bathroom apartment typically requires:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>4-6 hours</strong> with one cleaner</li>
                    <li><strong>3-4 hours</strong> with two cleaners working together</li>
                  </ul>
                  <p>Deep cleaning includes everything in basic cleaning plus: baseboards, window sills, inside appliances, cabinet fronts, light fixtures, and detailed bathroom and kitchen deep cleaning. This service is perfect for move-ins or when you haven't had professional cleaning in a while.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-white rounded-lg border">
              <AccordionTrigger className="px-6 py-4 text-left">
                How long does a move-in/move-out cleaning take for a 1-bedroom, 1-bathroom apartment?
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                <div className="text-slate-600 space-y-3">
                  <p>Move-in/move-out cleaning for a 1-bedroom, 1-bathroom apartment typically takes:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li><strong>5-7 hours</strong> with one cleaner</li>
                    <li><strong>3-4 hours</strong> with two cleaners working together</li>
                  </ul>
                  <p>This comprehensive service includes deep cleaning of all areas, inside all cabinets and drawers, appliance cleaning inside and out, baseboard cleaning, and ensuring the space is move-in ready. This is our most thorough cleaning service.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-white rounded-lg border">
              <AccordionTrigger className="px-6 py-4 text-left">
                What areas do you serve in Arizona?
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                <div className="text-slate-600">
                  <p>We proudly serve the following Arizona communities:</p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Tempe</li>
                    <li>Chandler</li>
                    <li>Gilbert</li>
                    <li>Mesa</li>
                    <li>Phoenix</li>
                    <li>Glendale</li>
                    <li>Scottsdale</li>
                    <li>Avondale</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5" className="bg-white rounded-lg border">
              <AccordionTrigger className="px-6 py-4 text-left">
                What are your cleaning rates?
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                <div className="text-slate-600">
                  <p>Our transparent hourly rates are:</p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li><strong>Regular Cleaning:</strong> $40/hour per cleaner</li>
                    <li><strong>Deep Cleaning:</strong> $45/hour per cleaner</li>
                    <li><strong>Move In/Out Cleaning:</strong> $70/hour per cleaner</li>
                    <li><strong>Janitorial Services:</strong> $70/hour per cleaner</li>
                  </ul>
                  <p className="mt-2">All prices are per cleaner, per hour. You can select the number of hours based on your specific needs.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6" className="bg-white rounded-lg border">
              <AccordionTrigger className="px-6 py-4 text-left">
                Are your cleaners licensed and insured?
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                <div className="text-slate-600">
                  <p>Yes! All our cleaners are:</p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Licensed and bonded</li>
                    <li>Fully insured for your protection</li>
                    <li>Background checked for your safety and peace of mind</li>
                    <li>Experienced professionals with excellent ratings</li>
                  </ul>
                  <p className="mt-2">We take your security and satisfaction seriously, which is why we only work with trusted, verified cleaning professionals.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-7" className="bg-white rounded-lg border">
              <AccordionTrigger className="px-6 py-4 text-left">
                How do I schedule a cleaning service?
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                <div className="text-slate-600">
                  <p>Booking is easy! Simply:</p>
                  <ol className="list-decimal pl-6 mt-2 space-y-1">
                    <li>Click "Book Now" to start</li>
                    <li>Select your desired cleaning service</li>
                    <li>Choose your preferred cleaner</li>
                    <li>Pick a date and time that works for you</li>
                    <li>Enter your location and contact details</li>
                    <li>Complete secure payment through our app</li>
                  </ol>
                  <p className="mt-2">You'll receive confirmation immediately and can contact us at (833) 735-TATI if you have any questions.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-8" className="bg-white rounded-lg border">
              <AccordionTrigger className="px-6 py-4 text-left">
                What if I'm not satisfied with the cleaning?
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                <div className="text-slate-600">
                  <p>Your satisfaction is our guarantee! If you're not completely happy with our service:</p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Contact us within 24 hours at (833) 735-TATI</li>
                    <li>We'll return to re-clean any missed areas at no additional cost</li>
                    <li>Our goal is to ensure you're 100% satisfied with every cleaning</li>
                  </ul>
                  <p className="mt-2">We stand behind our work and are committed to making it right.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-6 md:mb-0">
              <img
                src="https://customer-assets.emergentagent.com/job_cleanbook-1/artifacts/nww6p860_tatis-cleaners-high-resolution-logo.png"
                alt="Tati's Cleaners"
                className="h-10 w-10 rounded-full"
              />
              <div>
                <h3 className="text-xl font-bold">Tati's Cleaners</h3>
                <p className="text-slate-400">Professional cleaning services</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <a href="tel:8337358284" className="flex items-center space-x-2 hover:text-emerald-400">
                <Phone className="w-5 h-5" />
                <span>(833) 735-TATI</span>
              </a>
            </div>
          </div>
          
          <div className="text-center text-slate-400 text-sm mt-8 pt-8 border-t border-slate-700">
            © 2024 Tati's Cleaners. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;