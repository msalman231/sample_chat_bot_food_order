import React from 'react';

const MultiBulkMessage = ({ content, menuData, onItemClick }) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
        <h3 className="font-bold text-lg text-gray-800 mb-2">
          🎯 Multi-Category Order Progress
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          {content.message}
        </p>
        
        {/* Progress indicator */}
        <div className="flex items-center justify-center space-x-2 mb-3">
          {content.categories.map((cat, index) => (
            <div key={index} className={`px-3 py-1 rounded-full text-xs font-medium ${
              index === content.currentIndex 
                ? 'bg-blue-500 text-white'
                : index < content.currentIndex
                ? 'bg-green-500 text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              {cat.quantity} {cat.category}
              {index < content.currentIndex && ' ✓'}
              {index === content.currentIndex && ' 👈'}
            </div>
          ))}
        </div>
        
        <div className="bg-blue-100 rounded-lg p-2">
          <p className="text-sm text-blue-800 font-semibold">
            Currently selecting: {content.currentQuantity} {content.currentCategory}
          </p>
          <p className="text-xs text-blue-600">
            Step {content.currentIndex + 1} of {content.totalCategories}
          </p>
        </div>
      </div>
      
      {/* Show current category items */}
      <div>
        <h4 className="font-semibold text-gray-800 mb-3 text-center">
          Choose from {content.currentCategory}:
        </h4>
        <div className="space-y-3">
          {(menuData?.menuItems?.filter(item => 
            item.category.toLowerCase().includes(content.currentCategory.toLowerCase()) && 
            !item.isAddon && 
            item.available
          ) || []).map((item, index) => (
            <div key={index} className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200 hover:shadow-md transition-all cursor-pointer"
                 onClick={() => onItemClick(item, content)}>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-800 flex-1">{item.name}</h4>
                <div className="text-right ml-2">
                  <span className="font-bold text-lg text-blue-600">${item.price} each</span>
                  <p className="text-xs text-blue-500">Total: ${(item.price * content.currentQuantity).toFixed(2)}</p>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-2">{item.description}</p>
              
              {item.ingredients && item.ingredients.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {item.ingredients.slice(0, 3).map((ingredient, ingIndex) => (
                    <span key={ingIndex} className="text-xs bg-white text-gray-600 px-2 py-1 rounded-full border">
                      {ingredient}
                    </span>
                  ))}
                  {item.ingredients.length > 3 && (
                    <span className="text-xs text-gray-500 px-2 py-1">+{item.ingredients.length - 3} more</span>
                  )}
                </div>
              )}
              
              <div className="mt-3 pt-2 border-t border-blue-200">
                <p className="text-xs text-blue-600 font-medium text-center">
                  👆 Click to add {content.currentQuantity} of this item
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="text-center mt-4 pt-3 border-t bg-blue-50 rounded-lg p-3">
        <p className="text-sm text-blue-700 font-medium mb-1">
          🔄 Multi-Category Order in Progress
        </p>
        <p className="text-xs text-gray-600">
          After selecting from {content.currentCategory}, we'll move to the next category automatically.
        </p>
      </div>
    </div>
  );
};

export default MultiBulkMessage;