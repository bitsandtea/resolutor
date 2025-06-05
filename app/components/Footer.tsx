"use client";

import React from "react";

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-700 text-white py-8 mt-auto">
      <div className="container mx-auto px-6 text-center">
        <p>&copy; {new Date().getFullYear()} Resolutor. All rights reserved.</p>
        <div className="mt-2">
          <a
            href="/privacy-policy"
            className="text-sm hover:text-gray-300 mx-2"
          >
            Privacy Policy
          </a>
          <a
            href="/terms-of-service"
            className="text-sm hover:text-gray-300 mx-2"
          >
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
