import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { API_BASE } from '../utils/apiBase';
import { formatCurrencyPHP } from '../utils/currency';
import { getComponentImage } from '../utils/componentImages';

const HeroSlideshow = ({ setCurrentPage }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);


  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);


  // Map of category_id to category name
  const categoryIdToName = {
    1: 'CPU', 2: 'Motherboard', 3: 'GPU', 4: 'RAM', 5: 'Storage', 6: 'PSU', 7: 'Case', 8: 'Cooler', 9: 'Aio', 11: 'Case Gaming',
    // Add more as needed
  };

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        const response = await fetch(`${API_BASE}/get_all_components.php`);
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          // Only allow real PC component categories by category_id
          const allowedCategoryIds = [1,2,3,4,5,6,7,8,9,11];
          const filtered = result.data.filter(comp =>
            allowedCategoryIds.includes(Number(comp.category_id))
          ).map(comp => ({
            ...comp,
            category: categoryIdToName[Number(comp.category_id)] || comp.category_id
          }));
          // Parse price, sort by price descending, deduplicate by id or brand+name, and keep 15 unique items
          const withPrice = filtered
            .map(comp => ({
              ...comp,
              priceValue: parseFloat((comp.price || '').toString().replace(/[^0-9.]/g, '')) || 0
            }));

          const sorted = withPrice.sort((a, b) => b.priceValue - a.priceValue);

          // Build a stable image key using resolver to dedupe identical visuals
          const buildImageKey = (comp) => {
            try {
              const img = getComponentImage(comp, (comp.category || '').toLowerCase());
              return (img || '').toLowerCase();
            } catch {
              return '';
            }
          };

          // Deduplicate by id OR by normalized name brand AND image key
          const seenById = new Set();
          const seenByVisual = new Set();
          const unique = [];
          for (const comp of sorted) {
            const idKey = comp.id ? String(comp.id) : null;
            const nameKey = `${(comp.brand || '').toString().toLowerCase().trim()}::${(comp.name || '').toString().toLowerCase().trim()}`;
            const imgKey = buildImageKey(comp);
            const visualKey = `${nameKey}::${imgKey}`;
            if (idKey && seenById.has(idKey)) continue;
            if (seenByVisual.has(visualKey)) continue;
            if (idKey) seenById.add(idKey);
            seenByVisual.add(visualKey);
            unique.push(comp);
          }

          const TARGET_COUNT = 15;
          const finalList = unique.slice(0, TARGET_COUNT);
          setComponents(finalList);
        } else {
          setComponents([]);
        }
      } catch (e) {
        setComponents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchComponents();
  }, []);

  // Handle slide transitions
  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  // Handle next slide
  const nextSlide = () => {
    setCurrentSlide(prev => (prev + 1) % components.length);
  };

  // Handle previous slide
  const prevSlide = () => {
    setCurrentSlide(prev => (prev - 1 + components.length) % components.length);
  };


  // Only reset currentSlide if it is out of bounds after components change
  useEffect(() => {
    if (currentSlide >= components.length && components.length > 0) {
      setCurrentSlide(0);
    }
  }, [components.length, currentSlide]);

  // Clamp currentSlide if it is out of bounds after components change
  useEffect(() => {
    if (components.length === 0) return;
    if (currentSlide >= components.length) {
      setCurrentSlide(Math.max(components.length - 1, 0));
    }
  }, [components.length, currentSlide]);

  // Set up auto-advance timer only if there are slides
  useEffect(() => {
    if (!components || components.length === 0 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % components.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [components.length, isPaused]);

  // Preload all slide images and also neighbor slides
  useEffect(() => {
    if (!components || components.length === 0) return;
    const BASE_URL = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
    const baseNoSlash = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
    const sources = new Set();
    components.forEach((comp) => {
      const src = getComponentImage(comp, (comp.category || '').toLowerCase()) || `${baseNoSlash}/images/placeholder-component.svg`;
      if (src) sources.add(src);
    });
    const neighborIdx = [
      (currentSlide + 1) % components.length,
      (currentSlide - 1 + components.length) % components.length
    ];
    neighborIdx.forEach((idx) => {
      const comp = components[idx];
      if (!comp) return;
      const src = getComponentImage(comp, (comp.category || '').toLowerCase()) || `${baseNoSlash}/images/placeholder-component.svg`;
      if (src) sources.add(src);
    });
    sources.forEach((src) => {
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
    });
  }, [components, currentSlide]);


  if (loading) {
    return (
      <section className="relative h-screen flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
        <div className="text-white text-xl font-semibold">Loading components...</div>
      </section>
    );
  }

  // If nothing loaded or empty, show the fallback message
  if (!components || components.length === 0) {
    return (
      <section className="relative h-screen flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
        <div className="text-white text-xl font-semibold text-center">
          No PC components with working images found for the slideshow.<br />
          Please check your database or try again later.
        </div>
      </section>
    );
  }

  const currentComponent = components[Math.min(currentSlide, components.length - 1)];
  const BASE_URL = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
  const baseNoSlash = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const resolvedBg = getComponentImage(currentComponent, (currentComponent?.category || '').toLowerCase());
  const bgImage = resolvedBg && resolvedBg.trim() !== '' ? resolvedBg : `${baseNoSlash}/images/placeholder-component.svg`;

  return (
    <section
      className="relative h-screen overflow-hidden bg-gray-900"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Decorative background layers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-30"
             style={{ background: 'radial-gradient(closest-side, rgba(16,185,129,0.6), rgba(16,185,129,0) 70%)' }} />
        <div className="absolute -bottom-24 -right-24 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-25"
             style={{ background: 'radial-gradient(closest-side, rgba(59,130,246,0.5), rgba(59,130,246,0) 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full blur-[80px] opacity-15"
             style={{ background: 'radial-gradient(closest-side, rgba(147,51,234,0.5), rgba(147,51,234,0) 70%)' }} />
      </div>

      <div className="relative h-full">
        {(() => {
          const component = currentComponent;
          const gradient = component?.gradient || 'from-blue-700 to-gray-900';
          const gradientColors = gradient.includes('from-') 
            ? gradient.replace('from-', '').replace('to-', '').split(' ').map((color, idx) => {
                const colorMapRgb = {
                  'blue-700': '29,78,216',
                  'gray-900': '17,24,39',
                  'purple-700': '124,58,237',
                  'green-700': '21,128,61',
                  'red-700': '185,28,28',
                  'indigo-700': '67,56,202'
                };
                const rgb = colorMapRgb[color] || '29,78,216';
                const alpha = idx === 0 ? 0.72 : 0.92; // slightly more opaque on the second color
                return `rgba(${rgb},${alpha})`;
              })
            : ['rgba(29,78,216,0.72)', 'rgba(17,24,39,0.92)'];
          const description = component?.description || (component?.brand ? `${component.brand} ${component.name}` : component?.name);
          const specs = Array.isArray(component?.specs) && component.specs.length > 0 ? component.specs : [];
          const originalPrice = component?.originalPrice || '';
          const priceValue = typeof component?.priceValue === 'number' ? component.priceValue : (parseFloat((component?.price || '').toString().replace(/[^0-9.]/g, '')) || 0);
          const numericOriginalPrice = originalPrice ? (parseFloat(originalPrice.toString().replace(/[^0-9.]/g, '')) || 0) : 0;

          if (typeof window !== 'undefined') {
            if (!window.__loggedImages) window.__loggedImages = {};
            const logKey = component?.id || `${component?.brand || ''}-${component?.name || ''}`;
            if (logKey && !window.__loggedImages[logKey]) {
              console.log(`HeroSlideshow: [${component?.name}] image_url=`, bgImage);
              window.__loggedImages[logKey] = true;
            }
          }

          return (
            <div
              key={component?.id || `${(component?.brand || '').toString()}-${(component?.name || '').toString()}-active`}
              className="absolute inset-0 opacity-100 z-10"
              style={{
                backgroundImage: `linear-gradient(135deg, ${gradientColors.join(', ')}), url('${bgImage}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundColor: '#0b1120'
              }}
            >
              <div className="h-full text-white flex items-center justify-center p-4">
                <div className="max-w-7xl mx-auto px-4 lg:px-8 w-full">
                  <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8 lg:gap-16">
                    <div className="lg:col-span-6 flex items-center justify-center">
                      <div className="relative anim-slide-in-left">
                        <div className="bg-black bg-opacity-35 rounded-2xl p-4 lg:p-8 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/10 anim-glow-pulse">
                          <img
                            src={bgImage}
                            alt={component?.name}
                            className="w-auto h-64 md:h-72 lg:h-80 xl:h-96 object-contain drop-shadow-[0_12px_40px_rgba(0,0,0,0.5)] select-none anim-float-y"
                            loading="eager"
                            decoding="async"
                            onError={(e) => {
                              const fallback = `${baseNoSlash}/images/placeholder-component.svg`;
                              if (e.currentTarget.src !== fallback) {
                                e.currentTarget.src = fallback;
                              }
                            }}
                          />
                        </div>
                        {/* subtle top-left shine */}
                        <div className="pointer-events-none absolute -top-6 -left-6 w-24 h-24 rounded-full opacity-40 blur-2xl" style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.35), rgba(255,255,255,0) 70%)' }} />
                      </div>
                    </div>
                    <div className="lg:col-span-6 text-center lg:text-left anim-slide-in-right">
                      <div className="flex flex-col h-full justify-between">
                        <div>
                          <span className="inline-block bg-white bg-opacity-90 text-gray-900 text-sm font-semibold px-3 py-1 rounded-full mb-4 shadow-md">
                            {component?.category}
                          </span>
                          <h1 className="text-3xl lg:text-5xl font-extrabold mb-3 lg:mb-4 leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]">
                            {component?.name}
                          </h1>
                          <p className="text-base lg:text-lg mb-6 text-gray-200 leading-relaxed max-w-xl">
                            {description}
                          </p>
                          <div className="mb-6">
                            <div className="flex items-baseline justify-center lg:justify-start">
                              <span className="text-3xl font-bold text-white">{formatCurrencyPHP(priceValue || 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                              {numericOriginalPrice > priceValue && (
                                <>
                                  <span className="ml-2 text-lg text-gray-300 line-through">{formatCurrencyPHP(numericOriginalPrice, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                  <span className="ml-2 text-sm bg-red-600 text-white px-2 py-0.5 rounded">
                                    {Math.round((1 - (priceValue / numericOriginalPrice)) * 100)}% OFF
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-6">
                            {specs.length > 0 && (
                              specs.slice(0, 4).map((spec, i) => (
                                <div key={i} className="bg-white bg-opacity-10 p-3 rounded-lg">
                                  <div className="text-xs text-gray-300">{spec.label}</div>
                                  <div className="font-medium text-white">{spec.value}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="mt-auto">
                          <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                              onClick={() => setCurrentPage('pc-assembly')}
                              className="flex-1 flex items-center justify-center px-6 py-3 border-2 border-transparent text-base font-medium rounded-lg text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] transform"
                            >
                              Add to Build
                              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                              onClick={() => setCurrentPage('pc-assembly')}
                              className="flex-1 flex items-center justify-center px-6 py-3 border-2 border-white text-base font-medium rounded-lg text-white hover:bg-white hover:bg-opacity-10 transition-all duration-200 hover:shadow-lg"
                            >
                              View All {component?.category}s
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-40 hover:bg-opacity-60 text-white p-3 rounded-full z-50 transition-all duration-200 focus:outline-none pointer-events-auto"
        aria-label="Previous component"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-40 hover:bg-opacity-60 text-white p-3 rounded-full z-50 transition-all duration-200 focus:outline-none pointer-events-auto"
        aria-label="Next component"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
        {components.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-200 ${
              index === currentSlide ? 'bg-white w-8' : 'bg-white bg-opacity-40 hover:bg-opacity-70'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
      <div className="absolute bottom-0 left-0 w-full h-1 bg-white bg-opacity-10">
        <div 
          className="h-full bg-white transition-all duration-5000 ease-linear"
          style={{ 
            width: `${((currentSlide + 1) / components.length) * 100}%`,
            transitionDuration: '5000ms'
          }}
        />
      </div>
    </section>
  );
};

export default HeroSlideshow;