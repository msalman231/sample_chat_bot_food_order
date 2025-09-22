import React from 'react';

const AlternativesMessage = ({ content, onItemClick }) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="font-bold text-lg text-gray-800 mb-1">
          🎆 {content.title}
        </h3>
        <p className="text-sm text-gray-600">Since "{content.unavailableItem}" isn't available right now</p>
      </div>
      
      <div className="space-y-3">
        {content.items.map((item, index) => (
          <div key={index} className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200 hover:shadow-md transition-all cursor-pointer"
               onClick={() => onItemClick(item)}>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-gray-800 flex-1">{item.name}</h4>
              <span className="font-bold text-lg text-green-600 ml-2">${item.price}</span>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">{item.description}</p>
            
            {item.ingredients && item.ingredients.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.ingredients.slice(0, 4).map((ingredient, ingIndex) => (
                  <span key={ingIndex} className="text-xs bg-white text-gray-600 px-2 py-1 rounded-full border">
                    {ingredient}
                  </span>
                ))}
                {item.ingredients.length > 4 && (
                  <span className="text-xs text-gray-500 px-2 py-1">+{item.ingredients.length - 4} more</span>
                )}
              </div>
            )}
            
            <div className="mt-3 pt-2 border-t border-green-200">
              <p className="text-xs text-green-600 font-medium">
                👆 Tap to add this alternative to your cart
              </p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center mt-4 pt-3 border-t">
        <p className="text-xs text-gray-500">
          💬 These items have similar flavors and are just as delicious!
        </p>
      </div>
    </div>
  );
};

export default AlternativesMessage;