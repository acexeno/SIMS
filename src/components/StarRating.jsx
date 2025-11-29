import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';

const StarRating = ({ 
  rating = 0, 
  maxRating = 5, 
  size = 'md', 
  interactive = false, 
  onRatingChange = null,
  showAverage = false,
  totalRatings = 0,
  userRating = 0,
  className = ''
}) => {
  const [hoverRating, setHoverRating] = useState(0);
  const [currentRating, setCurrentRating] = useState(Number(rating) || 0);

  useEffect(() => {
    setCurrentRating(Number(rating) || 0);
  }, [rating]);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8'
  };

  const handleStarClick = (starRating) => {
    if (interactive && onRatingChange) {
      setCurrentRating(starRating);
      onRatingChange(starRating);
    }
  };

  const handleStarHover = (starRating) => {
    if (interactive) {
      setHoverRating(starRating);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0);
    }
  };

  const displayRating = interactive ? (hoverRating || currentRating) : currentRating;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div 
        className="flex items-center gap-0.5"
        onMouseLeave={handleMouseLeave}
      >
        {Array.from({ length: maxRating }, (_, index) => {
          const starRating = index + 1;
          const isFilled = starRating <= displayRating;
          const isHalfFilled = starRating === Math.ceil(displayRating) && displayRating % 1 !== 0;
          
          return (
            <button
              key={index}
              type="button"
              className={`${sizeClasses[size]} transition-colors ${
                interactive 
                  ? 'cursor-pointer hover:scale-110 transform transition-transform' 
                  : 'cursor-default'
              }`}
              onClick={() => handleStarClick(starRating)}
              onMouseEnter={() => handleStarHover(starRating)}
              disabled={!interactive}
            >
              <Star
                className={`${
                  isFilled 
                    ? 'text-yellow-400 fill-current' 
                    : isHalfFilled
                    ? 'text-yellow-400 fill-current opacity-50'
                    : 'text-gray-300'
                }`}
                size={size === 'sm' ? 16 : size === 'md' ? 20 : size === 'lg' ? 24 : 32}
              />
            </button>
          );
        })}
      </div>
      
      {showAverage && (
        <div className="ml-2 text-sm text-gray-600">
          <span className="font-medium">{Number(currentRating || 0).toFixed(1)}</span>
          {totalRatings > 0 && (
            <span className="text-gray-500"> ({totalRatings} rating{totalRatings !== 1 ? 's' : ''})</span>
          )}
        </div>
      )}
    </div>
  );
};

export default StarRating;
