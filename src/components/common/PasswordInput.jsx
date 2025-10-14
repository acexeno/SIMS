import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const PasswordInput = ({ 
  id, 
  name, 
  value, 
  onChange, 
  placeholder, 
  autoComplete, 
  required = false, 
  className = "",
  showStrengthIndicator = false,
  strengthScore = 0,
  strengthLabel = ""
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          className={`${className} pr-10`}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
        </button>
      </div>
      {showStrengthIndicator && (
        <>
          <div className="mt-1 h-2 w-full bg-gray-200 rounded">
            <div
              className={`h-2 rounded ${strengthScore >= 3 ? 'bg-green-600' : strengthScore === 2 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, strengthScore * 25)}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">Strength: {strengthLabel}</p>
        </>
      )}
    </div>
  );
};

export default PasswordInput;
