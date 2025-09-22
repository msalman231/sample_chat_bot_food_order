import React from 'react';

const CategoryMessage = ({ content, onItemClick }) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="font-bold text-lg text-gray-800 mb-1">
          🍴 {content.categoryName} Menu
        </h3>
        <p className="text-sm text-gray-600">
          {content.bulkMode 
            ? `Bulk mode: Each item adds ${content.quantity} to your cart`
            : 'Tap any item to add it to your cart'
          }
        </p>
        {content.bulkMode && (
          <div className="mt-2">
            <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">
              Quantity per click: {content.quantity}
            </span>
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        {content.items.map((item, index) => (
          <div 
            key={index} 
            className={`rounded-lg p-4 border hover:shadow-md transition-all cursor-pointer ${
              content.bulkMode 
                ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200'
                : 'bg-gradient-to-r from-gray-50 to-gray-100'
            }`}
            onClick={() => onItemClick(item)}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-gray-800 flex-1">{item.name}</h4>
              <div className="text-right ml-2">
                <span className="font-bold text-lg text-green-600">${item.price}{content.bulkMode ? ' each' : ''}</span>
                {content.bulkMode && (
                  <p className="text-xs text-purple-600 font-medium">Total: ${(item.price * content.quantity).toFixed(2)}</p>
                )}
              </div>
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
            
            <div className="mt-3 pt-2 border-t border-gray-200">
              <p className="text-xs text-primary-600 font-medium">
                {content.bulkMode 
                  ? `👆 Tap to add ${content.quantity} of this item`
                  : `👆 Tap to add to cart or say "Add ${item.name}"`
                }
              </p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center mt-4 pt-3 border-t">
        <p className="text-xs text-gray-500">
          💬 Examples: "Add 2 {content.items[0]?.name.split(' ')[0]}", "I want 3 {content.items[0]?.name}", "Get me a couple of {content.items[0]?.name}"
        </p>
      </div>
    </div>
  );
};

export default CategoryMessage;