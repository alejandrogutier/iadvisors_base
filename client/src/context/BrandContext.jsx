import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

const BrandContext = createContext(null);

export const BrandProvider = ({ children }) => {
  const { user } = useAuth();
  const [availableBrands, setAvailableBrands] = useState([]);
  const [currentBrandId, setCurrentBrandId] = useState(null);

  useEffect(() => {
    if (user?.brands?.length) {
      setAvailableBrands(user.brands);
      const storageKey = `iadvisors_brand_${user.id}`;
      const storedBrand = localStorage.getItem(storageKey);
      const defaultBrand = user.brands.find((brand) => brand.isDefault) || user.brands[0];
      const nextBrand = user.brands.find((brand) => brand.id === storedBrand) || defaultBrand;
      setCurrentBrandId(nextBrand?.id || null);
    } else {
      setAvailableBrands([]);
      setCurrentBrandId(null);
    }
  }, [user]);

  useEffect(() => {
    if (user?.id && currentBrandId) {
      localStorage.setItem(`iadvisors_brand_${user.id}`, currentBrandId);
      api.defaults.headers.common['x-brand-id'] = currentBrandId;
    } else {
      delete api.defaults.headers.common['x-brand-id'];
    }
  }, [user?.id, currentBrandId]);

  const brandHeaders = useMemo(() => {
    return currentBrandId ? { 'x-brand-id': currentBrandId } : {};
  }, [currentBrandId]);

  const withBrandHeaders = useCallback(
    (config = {}) => {
      if (!currentBrandId) return config || {};
      const mergedHeaders = {
        ...(config.headers || {}),
        ...brandHeaders
      };
      return { ...config, headers: mergedHeaders };
    },
    [brandHeaders, currentBrandId]
  );

  const currentBrand = useMemo(() => {
    return availableBrands.find((brand) => brand.id === currentBrandId) || null;
  }, [availableBrands, currentBrandId]);

  const setBrand = (brandId) => {
    if (!brandId) {
      setCurrentBrandId(null);
      return;
    }
    const exists = availableBrands.some((brand) => brand.id === brandId);
    if (exists) {
      setCurrentBrandId(brandId);
    }
  };

  const value = useMemo(
    () => ({
      currentBrand,
      currentBrandId,
      availableBrands,
      setBrand,
      brandHeaders,
      withBrandHeaders
    }),
    [currentBrand, currentBrandId, availableBrands, brandHeaders, setBrand, withBrandHeaders]
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
};

export const useBrand = () => useContext(BrandContext);
