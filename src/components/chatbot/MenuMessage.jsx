import React from 'react';

const MenuMessage = ({ content, onCategoryClick }) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="font-bold text-lg text-gray-800 mb-2">🍽️ Our Menu Categories</h3>
        <p className="text-sm text-gray-600">Tap any category to see all items</p>
      </div>
      
      <div className="grid gap-3">
        {content.categories.map((category, index) => (
          <div 
            key={index} 
            className="bg-gray-50 rounded-lg p-3 border hover:bg-gray-100 transition-colors cursor-pointer"
            onClick={() => onCategoryClick(category.name)}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-primary-600">{category.name}</h4>
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">
                {category.itemCount} items
              </span>
            </div>
            
            <div className="space-y-1">
              {category.sampleItems.map((item, itemIndex) => (
                <div key={itemIndex} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-medium text-green-600">${item.price}</span>
                </div>
              ))}
              {category.hasMore && (
                <p className="text-xs text-gray-500 italic">...and {category.moreCount} more</p>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center mt-4 pt-3 border-t">
        <p className="text-xs text-gray-500">
          💬 Say "Show me [category]" or "I want [category]" to see specific items
        </p>
      </div>
    </div>
  );
};

export default MenuMessage;