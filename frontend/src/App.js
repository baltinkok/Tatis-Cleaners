import React, { useState, useEffect } from 'react';
import './App.css';
import { Calendar } from './components/ui/calendar';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from './components/ui/accordion';
import { Star, Clock, MapPin, Phone, Mail, User, Calendar as CalendarIcon, CheckCircle, ArrowLeft, Smartphone, Wifi, WifiOff, HelpCircle } from 'lucide-react';

// PWA functionality
import { 
  registerSW, 
  initializeInstallPrompt, 
  checkPWASupport, 
  checkOnlineStatus,
  requestNotificationPermission,
  showNotification 
} from './pwa';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
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
    
    // Initialize PWA functionality
    initializePWA();
  }, []);

  // Initialize PWA features
  const initializePWA = () => {
    // Register service worker
    registerSW();
    
    // Initialize install prompt
    initializeInstallPrompt();
    
    // Check PWA support
    const pwaSupport = checkPWASupport();
    console.log('PWA features available:', pwaSupport);
    
    // Monitor connection status
    checkOnlineStatus();
    
    // Request notification permission after user interaction
    const requestPermissions = () => {
      requestNotificationPermission().then(granted => {
        if (granted) {
          console.log('Notifications enabled');
        }
      });
    };

    // Request permissions on first user interaction
    const handleFirstInteraction = () => {
      requestPermissions();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
  };

  const loadServices = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/services`);
      const data = await response.json();
      setServices(data.services);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const loadCleaners = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/cleaners`);
      const data = await response.json();
      setCleaners(data.cleaners);
    } catch (error) {
      console.error('Error loading cleaners:', error);
    }
  };

  const loadServiceAreas = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/service-areas`);
      const data = await response.json();
      setServiceAreas(data.areas);
    } catch (error) {
      console.error('Error loading service areas:', error);
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
        // Load booking details
        const bookingResponse = await fetch(`${BACKEND_URL}/api/bookings/${bookingId}`);
        const bookingData = await bookingResponse.json();
        setBooking(bookingData);
        
        // Send PWA notification for successful booking
        showNotification('Booking Confirmed! 🎉', {
          body: `Your cleaning service is booked for ${bookingData.date} at ${bookingData.time}`,
          tag: 'booking-confirmed',
          actions: [
            {
              action: 'view',
              title: 'View Details'
            }
          ]
        });
        
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
    setCurrentStep(prev => prev + 1);
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
        setBooking({ ...result, ...bookingData });
        setCurrentStep(5);
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
      alert('Error processing payment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotal = () => {
    if (selectedHours && selectedService && services[selectedService]) {
      return selectedHours * services[selectedService].base_price;
    }
    return 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_cleanpro-hire/artifacts/gpq5psdo_tatis-cleaners-high-resolution-logo-transparent.png" 
                alt="Tati's Cleaners Logo" 
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Tati's Cleaners</h1>
                <p className="text-xs sm:text-sm text-slate-600">Professional Cleaning Services</p>
              </div>
            </div>
            
            {/* PWA Status Indicator */}
            <div className="flex items-center space-x-2">
              {/* Online/Offline Status */}
              <div className="flex items-center space-x-1">
                {navigator.onLine ? (
                  <Wifi className="w-4 h-4 text-emerald-600" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500" />
                )}
                <span className="text-xs text-slate-500 hidden sm:inline">
                  {navigator.onLine ? 'Online' : 'Offline'}
                </span>
              </div>
              
              {/* PWA Install Indicator */}
              {window.matchMedia('(display-mode: standalone)').matches && (
                <div className="flex items-center space-x-1">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs text-emerald-600 hidden sm:inline">App</span>
                </div>
              )}
              
              {/* Back Button */}
              {currentStep > 1 && currentStep < 6 && (
                <Button variant="outline" onClick={handleBack} className="flex items-center space-x-2" size="sm">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 pb-20">{/* Extra bottom padding for mobile install button */}
        {/* Hero Section */}
        {currentStep === 1 && (
          <div className="space-y-16">
            <div className="text-center space-y-6">
              <h1 className="text-5xl font-bold text-slate-900 leading-tight">
                Professional Cleaning Services
                <span className="text-emerald-600 block">You Can Trust</span>
              </h1>
              <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                Book experienced cleaners for your home or office. Serving Arizona with reliable, 
                professional cleaning services at $40/hour per cleaner.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="flex items-center justify-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                  <span className="text-slate-700">Licensed & Insured</span>
                </div>
                <div className="flex items-center justify-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                  <span className="text-slate-700">Background Checked</span>
                </div>
                <div className="flex items-center justify-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                  <span className="text-slate-700">Satisfaction Guaranteed</span>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative h-96 rounded-2xl overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1686178827149-6d55c72d81df?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2Mzl8MHwxfHNlYXJjaHwxfHxjbGVhbmluZyUyMHNlcnZpY2V8ZW58MHx8fHwxNzU0MTE0OTM4fDA&ixlib=rb-4.1.0&q=85"
                alt="Professional cleaner at work" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/50 to-transparent flex items-center">
                <div className="text-white p-12">
                  <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
                  <p className="text-lg mb-6">Choose from our professional cleaning services</p>
                  <Button 
                    onClick={handleNext}
                    size="lg"
                    className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-3"
                  >
                    Book Now
                  </Button>
                </div>
              </div>
            </div>

            {/* Service Areas */}
            <Card className="p-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Serving Arizona Communities</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {serviceAreas.map((area) => (
                  <div key={area} className="flex items-center space-x-2 text-slate-700">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>{area}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* FAQ Section */}
            <Card className="p-8">
              <div className="text-center mb-8">
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <HelpCircle className="w-8 h-8 text-emerald-600" />
                  <h2 className="text-3xl font-bold text-slate-900">Frequently Asked Questions</h2>
                </div>
                <p className="text-slate-600 max-w-2xl mx-auto">
                  Get answers to common questions about our professional cleaning services
                </p>
              </div>

              <div className="max-w-4xl mx-auto">
                <Accordion type="single" collapsible className="space-y-4">
                  
                  <AccordionItem value="pricing" className="border border-slate-200 rounded-lg px-6">
                    <AccordionTrigger className="text-left hover:text-emerald-600">
                      <span className="font-semibold">How much do your cleaning services cost?</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 pt-4">
                      <div className="space-y-3">
                        <p>Our pricing is simple and transparent:</p>
                        <ul className="space-y-2">
                          <li><strong>Regular Cleaning:</strong> $40/hour per cleaner</li>
                          <li><strong>Deep Cleaning:</strong> $45/hour per cleaner</li>
                          <li><strong>Move In/Out Cleaning:</strong> $70/hour per cleaner</li>
                          <li><strong>Janitorial Cleaning:</strong> $70/hour per cleaner</li>
                        </ul>
                        <p>Most regular cleanings take 2-4 hours depending on home size. You choose exactly how many hours you need when booking.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="areas" className="border border-slate-200 rounded-lg px-6">
                    <AccordionTrigger className="text-left hover:text-emerald-600">
                      <span className="font-semibold">What areas do you serve in Arizona?</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 pt-4">
                      <p className="mb-3">We proudly serve these Arizona communities:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {serviceAreas.map((area) => (
                          <div key={area} className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                            <span>{area}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3">Don't see your area? Call us at (833) 735-TATI - we may be expanding to your location soon!</p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="booking" className="border border-slate-200 rounded-lg px-6">
                    <AccordionTrigger className="text-left hover:text-emerald-600">
                      <span className="font-semibold">How do I book a cleaning appointment?</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 pt-4">
                      <div className="space-y-3">
                        <p>Booking is easy with our online system:</p>
                        <ol className="list-decimal list-inside space-y-2">
                          <li>Choose your service type (Regular, Deep, Move In/Out, or Janitorial)</li>
                          <li>Select your preferred cleaner from our experienced team</li>
                          <li>Pick your date, time, and number of hours needed</li>
                          <li>Enter your contact information and service address</li>
                          <li>Complete secure payment through Stripe</li>
                          <li>Receive instant confirmation and reminders</li>
                        </ol>
                        <p>You can also call us directly at <strong>(833) 735-TATI</strong> for phone bookings.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="cleaners" className="border border-slate-200 rounded-lg px-6">
                    <AccordionTrigger className="text-left hover:text-emerald-600">
                      <span className="font-semibold">Are your cleaners licensed and insured?</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 pt-4">
                      <div className="space-y-3">
                        <p><strong>Yes!</strong> Your safety and peace of mind are our top priorities:</p>
                        <ul className="space-y-2">
                          <li>✅ <strong>Licensed & Insured:</strong> All cleaners are fully licensed and bonded</li>
                          <li>✅ <strong>Background Checked:</strong> Comprehensive background checks on all team members</li>
                          <li>✅ <strong>Experienced Team:</strong> Our cleaners have 3-9 years of professional experience</li>
                          <li>✅ <strong>Satisfaction Guaranteed:</strong> 100% satisfaction guarantee on all services</li>
                        </ul>
                        <p>Meet our team: Ivon Gamez (9 years, 5-star rating), Lucia Coronado (3 years, 4.9 stars), Ana Garcia (7 years, 4.9 stars), and Jessica Martinez (4 years, 4.7 stars).</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="supplies" className="border border-slate-200 rounded-lg px-6">
                    <AccordionTrigger className="text-left hover:text-emerald-600">
                      <span className="font-semibold">Do I need to provide cleaning supplies?</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 pt-4">
                      <div className="space-y-3">
                        <p><strong>We bring everything!</strong> Our professional cleaners arrive fully equipped with:</p>
                        <ul className="space-y-2">
                          <li>🧽 All cleaning supplies and equipment</li>
                          <li>🧴 Professional-grade, eco-friendly cleaning products</li>
                          <li>🧹 Vacuum cleaners, mops, and specialized tools</li>
                          <li>🧤 Protective equipment and safety gear</li>
                        </ul>
                        <p>Just relax and let us handle everything. If you have specific product preferences or allergies, please mention them in the special instructions when booking.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="payment" className="border border-slate-200 rounded-lg px-6">
                    <AccordionTrigger className="text-left hover:text-emerald-600">
                      <span className="font-semibold">When and how do I pay?</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 pt-4">
                      <div className="space-y-3">
                        <p>Payment is secure and convenient:</p>
                        <ul className="space-y-2">
                          <li>💳 <strong>Pay Online:</strong> Secure payment through Stripe when you book</li>
                          <li>💰 <strong>Accepted Methods:</strong> All major credit/debit cards, Apple Pay, Google Pay</li>
                          <li>📧 <strong>Instant Receipt:</strong> Email confirmation and receipt immediately</li>
                          <li>🔒 <strong>Secure Processing:</strong> Bank-level encryption protects your information</li>
                        </ul>
                        <p>Payment is required at booking to secure your appointment. No cash handling needed!</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="cancellation" className="border border-slate-200 rounded-lg px-6">
                    <AccordionTrigger className="text-left hover:text-emerald-600">
                      <span className="font-semibold">What's your cancellation policy?</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 pt-4">
                      <div className="space-y-3">
                        <p>We understand plans change. Our flexible policy:</p>
                        <ul className="space-y-2">
                          <li>📞 <strong>24+ Hours:</strong> Full refund for cancellations 24+ hours in advance</li>
                          <li>⏰ <strong>Same Day:</strong> 50% refund for same-day cancellations</li>
                          <li>🔄 <strong>Reschedule:</strong> Free rescheduling anytime before service</li>
                          <li>☔ <strong>Weather/Emergency:</strong> Full refund for weather or emergency cancellations</li>
                        </ul>
                        <p>To cancel or reschedule, call us at <strong>(833) 735-TATI</strong> or email info@tatiscleaners.com.</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="time" className="border border-slate-200 rounded-lg px-6">
                    <AccordionTrigger className="text-left hover:text-emerald-600">
                      <span className="font-semibold">How long does cleaning take?</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 pt-4">
                      <div className="space-y-3">
                        <p>Cleaning time depends on your home size and service type:</p>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <h5 className="font-semibold text-slate-800 mb-2">Regular Cleaning:</h5>
                            <ul className="space-y-1 text-sm">
                              <li>• 1-2 bedroom: 2-3 hours</li>
                              <li>• 3-4 bedroom: 3-4 hours</li>
                              <li>• 5+ bedroom: 4-6 hours</li>
                            </ul>
                          </div>
                          <div>
                            <h5 className="font-semibold text-slate-800 mb-2">Deep Cleaning:</h5>
                            <ul className="space-y-1 text-sm">
                              <li>• Add 1-2 hours to regular times</li>
                              <li>• First-time deep clean may take longer</li>
                              <li>• Move in/out: 4-8 hours typical</li>
                            </ul>
                          </div>
                        </div>
                        <p><strong>You choose the hours</strong> when booking - pay only for the time you need!</p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="contact" className="border border-slate-200 rounded-lg px-6">
                    <AccordionTrigger className="text-left hover:text-emerald-600">
                      <span className="font-semibold">How can I contact Tati's Cleaners?</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 pt-4">
                      <div className="space-y-4">
                        <p>We're here to help! Contact us anytime:</p>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div className="flex items-center space-x-3">
                              <Phone className="w-5 h-5 text-emerald-600" />
                              <div>
                                <p className="font-semibold">Phone</p>
                                <p>(833) 735-TATI</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Mail className="w-5 h-5 text-emerald-600" />
                              <div>
                                <p className="font-semibold">Email</p>
                                <p>info@tatiscleaners.com</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center space-x-3">
                              <Clock className="w-5 h-5 text-emerald-600" />
                              <div>
                                <p className="font-semibold">Hours</p>
                                <p>Mon-Sun: 8:00 AM - 6:00 PM</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <Smartphone className="w-5 h-5 text-emerald-600" />
                              <div>
                                <p className="font-semibold">Online</p>
                                <p>Book 24/7 through this app</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                </Accordion>
              </div>

              {/* Call to Action */}
              <div className="text-center mt-12 p-8 bg-emerald-50 rounded-xl">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Ready to Book Your Cleaning?</h3>
                <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
                  Still have questions? Our friendly team is standing by to help you choose the perfect cleaning service for your needs.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    onClick={() => setCurrentStep(2)}
                    size="lg" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8"
                  >
                    Book Online Now
                  </Button>
                  <Button 
                    onClick={() => window.open('tel:+18337358284')}
                    variant="outline" 
                    size="lg" 
                    className="text-lg px-8"
                  >
                    <Phone className="w-5 h-5 mr-2" />
                    Call (833) 735-TATI
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Step 2: Service Selection */}
        {currentStep === 2 && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Choose Your Service</h2>
              <p className="text-slate-600">Select the type of cleaning service you need</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {Object.entries(services).map(([key, service]) => (
                <Card 
                  key={key}
                  className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                    selectedService === key ? 'ring-2 ring-emerald-500 bg-emerald-50' : ''
                  }`}
                  onClick={() => setSelectedService(key)}
                >
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">{service.name}</h3>
                  <p className="text-slate-600 mb-4">{service.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-emerald-600">${service.base_price}/hour</span>
                    {selectedService === key && (
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {selectedService && (
              <div className="text-center">
                <Button onClick={handleNext} size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                  Continue
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Cleaner Selection */}
        {currentStep === 3 && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Choose Your Cleaner</h2>
              <p className="text-slate-600">Select from our experienced cleaning professionals</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {cleaners.map((cleaner) => (
                <Card 
                  key={cleaner.id}
                  className={`p-6 cursor-pointer transition-all hover:shadow-lg ${
                    selectedCleaner?.id === cleaner.id ? 'ring-2 ring-emerald-500 bg-emerald-50' : ''
                  }`}
                  onClick={() => setSelectedCleaner(cleaner)}
                >
                  <div className="mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{cleaner.name}</h3>
                      <div className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-slate-600">{cleaner.rating}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600">{cleaner.experience_years} years exp.</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-600 font-medium">Specialties:</p>
                    <div className="flex flex-wrap gap-2">
                      {cleaner.specialties.map((specialty) => (
                        <Badge key={specialty} variant="secondary">{specialty}</Badge>
                      ))}
                    </div>
                  </div>
                  {selectedCleaner?.id === cleaner.id && (
                    <CheckCircle className="w-6 h-6 text-emerald-600 mt-4" />
                  )}
                </Card>
              ))}
            </div>

            {selectedCleaner && (
              <div className="text-center">
                <Button onClick={handleNext} size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                  Continue
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Scheduling & Details */}
        {currentStep === 4 && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Schedule & Details</h2>
              <p className="text-slate-600">Choose your preferred date, time, and location</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {/* Left Column - Date & Time */}
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Select Date</h3>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date() || date.getDay() === 0}
                    className="rounded-md border"
                  />
                </Card>

                {selectedDate && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Select Time</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {timeSlots.map((time) => (
                        <Button
                          key={time}
                          variant={selectedTime === time ? "default" : "outline"}
                          onClick={() => setSelectedTime(time)}
                          className={selectedTime === time ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  </Card>
                )}
              </div>

              {/* Right Column - Service Details */}
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Service Details</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Hours Needed
                      </label>
                      <select 
                        value={selectedHours}
                        onChange={(e) => setSelectedHours(parseInt(e.target.value))}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      >
                        {[1,2,3,4,5,6,7,8].map(hour => (
                          <option key={hour} value={hour}>{hour} hour{hour > 1 ? 's' : ''}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Service Area <span className="text-red-500">*</span>
                      </label>
                      <select 
                        value={selectedArea}
                        onChange={(e) => setSelectedArea(e.target.value)}
                        className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                          selectedArea ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300'
                        }`}
                      >
                        <option value="">Select area</option>
                        {serviceAreas.map(area => (
                          <option key={area} value={area}>{area}</option>
                        ))}
                      </select>
                      {!selectedArea && (
                        <p className="text-red-500 text-xs mt-1">Please select your service area</p>
                      )}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-lg text-slate-700">Total Cost:</span>
                        <span className="text-2xl font-bold text-emerald-600">${calculateTotal()}</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        {selectedHours} hour{selectedHours > 1 ? 's' : ''} × ${selectedService && services[selectedService] ? services[selectedService].base_price : 0}/hour
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Your Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        <User className="w-4 h-4 inline mr-1" />
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={customerInfo.name}
                        onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                        className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                          customerInfo.name ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300'
                        }`}
                        placeholder="Your full name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        <Mail className="w-4 h-4 inline mr-1" />
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={customerInfo.email}
                        onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                        className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                          customerInfo.email ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300'
                        }`}
                        placeholder="your.email@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        <Phone className="w-4 h-4 inline mr-1" />
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={customerInfo.phone}
                        onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                        className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                          customerInfo.phone ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300'
                        }`}
                        placeholder="(480) 555-1234"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Street Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={customerInfo.address}
                        onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                        className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                          customerInfo.address ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300'
                        }`}
                        placeholder="1234 Main St, Phoenix, AZ 85001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Special Instructions (Optional)
                      </label>
                      <textarea
                        value={customerInfo.instructions}
                        onChange={(e) => setCustomerInfo({...customerInfo, instructions: e.target.value})}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        rows="3"
                        placeholder="Any special requirements or instructions..."
                      />
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Progress indicator and Create Booking Button */}
            <div className="text-center space-y-4">
              {/* Progress indicator showing what's missing */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Booking Progress:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className={`flex items-center space-x-2 text-xs ${selectedDate ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {selectedDate ? <CheckCircle className="w-4 h-4" /> : <div className="w-4 h-4 border border-slate-300 rounded-full" />}
                    <span>Date Selected</span>
                  </div>
                  <div className={`flex items-center space-x-2 text-xs ${selectedTime ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {selectedTime ? <CheckCircle className="w-4 h-4" /> : <div className="w-4 h-4 border border-slate-300 rounded-full" />}
                    <span>Time Selected</span>
                  </div>
                  <div className={`flex items-center space-x-2 text-xs ${selectedArea ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {selectedArea ? <CheckCircle className="w-4 h-4" /> : <div className="w-4 h-4 border border-slate-300 rounded-full" />}
                    <span>Area Selected</span>
                  </div>
                  <div className={`flex items-center space-x-2 text-xs ${(customerInfo.name && customerInfo.email && customerInfo.phone && customerInfo.address) ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {(customerInfo.name && customerInfo.email && customerInfo.phone && customerInfo.address) ? <CheckCircle className="w-4 h-4" /> : <div className="w-4 h-4 border border-slate-300 rounded-full" />}
                    <span>Info Complete</span>
                  </div>
                </div>
              </div>

              {/* Show what's missing if not all fields completed */}
              {!(selectedDate && selectedTime && selectedArea && customerInfo.name && customerInfo.email && customerInfo.phone && customerInfo.address) && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                  <p className="text-amber-800 text-sm font-medium mb-2">Please complete the following to continue:</p>
                  <ul className="text-amber-700 text-sm space-y-1">
                    {!selectedDate && <li>• Select a date from the calendar</li>}
                    {!selectedTime && <li>• Choose a time slot (appears after selecting date)</li>}
                    {!selectedArea && <li>• Select your service area</li>}
                    {!customerInfo.name && <li>• Enter your full name</li>}
                    {!customerInfo.email && <li>• Enter your email address</li>}
                    {!customerInfo.phone && <li>• Enter your phone number</li>}
                    {!customerInfo.address && <li>• Enter your complete address</li>}
                  </ul>
                </div>
              )}

              {/* Create Booking Button - appears when all fields completed */}
              {selectedDate && selectedTime && selectedArea && customerInfo.name && customerInfo.email && customerInfo.phone && customerInfo.address ? (
                <div className="space-y-2">
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                    <p className="text-emerald-800 text-sm font-medium">🎉 Ready to book! All information completed.</p>
                  </div>
                  <Button 
                    onClick={handleBooking} 
                    size="lg" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-4"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Creating Booking...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>Create Booking</span>
                        <CheckCircle className="w-5 h-5" />
                      </div>
                    )}
                  </Button>
                </div>
              ) : (
                <Button 
                  size="lg" 
                  className="bg-slate-400 cursor-not-allowed text-lg px-8 py-4"
                  disabled={true}
                >
                  Complete All Fields Above
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Payment */}
        {currentStep === 5 && booking && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Review & Pay</h2>
              <p className="text-slate-600">Review your booking details and complete payment</p>
            </div>

            <Card className="max-w-2xl mx-auto p-8">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Booking Summary</h3>
                  <Separator className="my-4" />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Service:</span>
                    <span className="font-medium">{services[selectedService]?.name}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-600">Cleaner:</span>
                    <span className="font-medium">{selectedCleaner?.name}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-600">Date & Time:</span>
                    <span className="font-medium">
                      {selectedDate?.toLocaleDateString()} at {selectedTime}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-600">Duration:</span>
                    <span className="font-medium">{selectedHours} hour{selectedHours > 1 ? 's' : ''}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-600">Location:</span>
                    <span className="font-medium">{selectedArea}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-600">Address:</span>
                    <span className="font-medium">{customerInfo.address}</span>
                  </div>

                  <Separator />
                  
                  <div className="flex justify-between text-lg">
                    <span className="text-slate-900 font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-emerald-600">${booking.total_amount}</span>
                  </div>
                </div>

                <div className="text-center pt-4">
                  <Button 
                    onClick={handlePayment}
                    size="lg"
                    className="bg-emerald-600 hover:bg-emerald-700 w-full text-lg py-4"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Processing...' : 'Pay Now'}
                  </Button>
                  <p className="text-sm text-slate-500 mt-2">
                    Secure payment powered by Stripe
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Step 6: Payment Confirmation */}
        {currentStep === 6 && (
          <div className="space-y-8">
            <div className="text-center">
              {paymentStatus === 'success' && (
                <>
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-4">Payment Successful!</h2>
                  <p className="text-slate-600">Your cleaning service has been booked successfully.</p>
                  
                  {booking && (
                    <Card className="max-w-2xl mx-auto mt-8 p-6">
                      <h3 className="text-xl font-semibold text-slate-900 mb-4">Booking Confirmation</h3>
                      <div className="space-y-3 text-left">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Booking ID:</span>
                          <span className="font-medium">{booking.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Service:</span>
                          <span className="font-medium">{services[booking.service_type]?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Cleaner:</span>
                          <span className="font-medium">{booking.cleaner_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Date & Time:</span>
                          <span className="font-medium">{booking.date} at {booking.time}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Total Paid:</span>
                          <span className="font-medium text-emerald-600">${booking.total_amount}</span>
                        </div>
                      </div>
                    </Card>
                  )}
                </>
              )}
              
              {paymentStatus === 'failed' && (
                <>
                  <h2 className="text-3xl font-bold text-red-600 mb-4">Payment Failed</h2>
                  <p className="text-slate-600">There was an issue processing your payment. Please try again.</p>
                  <Button 
                    onClick={() => setCurrentStep(5)}
                    className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                  >
                    Try Again
                  </Button>
                </>
              )}
              
              {paymentStatus === '' && (
                <>
                  <h2 className="text-3xl font-bold text-slate-900 mb-4">Processing Payment...</h2>
                  <p className="text-slate-600">Please wait while we confirm your payment.</p>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mt-4"></div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white mt-16">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <img 
                  src="https://customer-assets.emergentagent.com/job_cleanpro-hire/artifacts/gpq5psdo_tatis-cleaners-high-resolution-logo-transparent.png" 
                  alt="Tati's Cleaners Logo" 
                  className="w-10 h-10 object-contain"
                />
                <span className="text-xl font-bold">Tati's Cleaners</span>
              </div>
              <p className="text-slate-400">
                Professional cleaning services you can trust. Serving Arizona communities 
                with reliable, quality cleaning solutions.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Services</h3>
              <ul className="space-y-2 text-slate-400">
                <li>Regular House Cleaning</li>
                <li>Deep Cleaning</li>
                <li>Move In/Out Cleaning</li>
                <li>Janitorial Services</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Contact</h3>
              <div className="space-y-2 text-slate-400">
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4" />
                  <span>(833) 735-TATI</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>info@tatiscleaners.com</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>Serving All Arizona</span>
                </div>
              </div>
            </div>
          </div>
          <Separator className="my-8 bg-slate-700" />
          <div className="text-center text-slate-400">
            <p>&copy; 2024 Tati's Cleaners. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;