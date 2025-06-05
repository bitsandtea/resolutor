"use client";

import Link from "next/link";
import React from "react";

const Header: React.FC = () => {
  return (
    <header className="bg-gray-800 text-white shadow-md">
      <nav className="container mx-auto px-6 py-3 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold hover:text-gray-300">
          Resolutor
        </Link>
        <div className="space-x-4">
          <Link href="/dashboard" className="hover:text-gray-300">
            Dashboard
          </Link>
          <Link href="/new" className="hover:text-gray-300">
            New Contract
          </Link>
          <Link href="/profile" className="hover:text-gray-300">
            Profile
          </Link>
        </div>
      </nav>
    </header>
  );
};

export default Header;
